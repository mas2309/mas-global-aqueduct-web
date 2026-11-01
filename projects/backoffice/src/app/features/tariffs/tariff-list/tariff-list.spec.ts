import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { tariff } from '../../../../testing/billing-fixtures';
import { access, authResponse, organization } from '../../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { ServiceType } from '../../organizations/organization.models';
import { PropertyUsage } from '../../subscribers/subscriber.models';
import { CURRENT_ORGANIZATION_URL } from '../../subscribers/subscribers-api';
import { Tariff, TariffCharge } from '../tariff.models';
import { TARIFFS_URL } from '../tariffs-api';
import { TariffList } from './tariff-list';

const WATER_URL = `${TARIFFS_URL}?serviceType=WATER`;
const SANITATION_URL = `${TARIFFS_URL}?serviceType=SANITATION`;

const charge: TariffCharge = {
  fixedCharge: 8000,
  consumptionCharge: 27500,
  adjustmentPercent: -50,
  adjustment: -17750,
  total: 17750,
  blocks: [
    { units: 10, pricePerUnit: 1500, amount: 15000 },
    { units: 5, pricePerUnit: 2500, amount: 12500 },
  ],
};

interface Actions {
  select: (service: ServiceType) => void;
  simulate: () => void;
  remove: (tariff: Tariff) => void;
  usage: { set: (usage: PropertyUsage) => void };
}

const SERVICE_AREAS_URL = '/api/v1/service-areas';

describe('TariffList', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<TariffList>;
  let element: HTMLElement;
  let actions: Actions;
  let confirmed: boolean;

  afterEach(() => context.http.verify());

  async function open(
    tariffs: Tariff[] | null,
    options: { role?: OrganizationRole; servicio?: ServiceType } = {},
  ): Promise<void> {
    confirmed = true;
    context = setUpPage({
      session: authResponse({ organization: access({ role: options.role ?? 'ORG_ADMIN' }) }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirmed) }) } },
      ],
    });
    fixture = TestBed.createComponent(TariffList);
    if (options.servicio) {
      fixture.componentRef.setInput('servicio', options.servicio);
    }
    element = fixture.nativeElement;
    actions = fixture.componentInstance as unknown as Actions;
    await settle();
    context.http.expectOne(SERVICE_AREAS_URL).flush([]);
    context.http
      .expectOne(CURRENT_ORGANIZATION_URL)
      .flush(organization({ services: ['WATER', 'SANITATION'] }));
    await settle();
    const request = context.http.expectOne(options.servicio ? SANITATION_URL : WATER_URL);
    if (tariffs) {
      request.flush(tariffs);
    } else {
      request.flush(null, { status: 500, statusText: 'Server Error' });
    }
    await settle();
  }

  it('muestra la tarifa vigente, la programada y las anteriores', async () => {
    await open([
      tariff({ id: 'next', validFrom: '2027-01-01', inEffect: false }),
      tariff(),
      tariff({ id: 'old', validFrom: '2025-01-01', inEffect: false }),
    ]);
    const text = textOf(element);

    expect(text).toContain('Tarifa vigente de acueducto');
    expect(text).toContain('0 a 10 m³');
    expect(text).toContain('Más de 10 m³');
    expect(text).toContain('Estrato 1: subsidio del 50 %');
    expect(text).toContain('Comercial: contribución del 20 %');
    expect(text).toContain('Tarifa programada');
    expect(text).toContain('Tarifas anteriores');
    expect(text).toContain('Nueva tarifa');
    expect(text).toContain('Simulador');
  });

  it('invita a definir la tarifa cuando el servicio no tiene', async () => {
    await open([]);

    expect(textOf(element)).toContain('Acueducto aún no tiene una tarifa vigente');
    expect(textOf(element)).toContain('Definir la tarifa');
    expect(textOf(element)).not.toContain('Simulador');
  });

  it('quien no administra solo consulta', async () => {
    await open([tariff({ id: 'next', validFrom: '2027-01-01', inEffect: false })], {
      role: 'OPERATOR',
    });
    const text = textOf(element);

    expect(text).toContain('Tarifa programada');
    expect(text).not.toContain('Nueva tarifa');
    expect(text).not.toContain('Definir la tarifa');
    expect(text).not.toContain('Eliminar');
  });

  it('abre el servicio pedido en la URL', async () => {
    await open([tariff({ serviceType: 'SANITATION', blocks: [] })], { servicio: 'SANITATION' });

    expect(textOf(element)).toContain('Tarifa vigente de aseo');
  });

  it('simula el valor de una factura', async () => {
    await open([tariff()]);

    actions.simulate();
    context.http
      .expectOne(
        `${TARIFFS_URL}/estimate?serviceType=WATER&consumption=15&usage=RESIDENTIAL&stratum=2`,
      )
      .flush(charge);
    await settle();
    const text = textOf(element);

    expect(text).toContain('Subsidio (-50 %)');
    expect(text).toContain('Total');
    expect(text).toContain('17,750');
  });

  it('simula sin consumo ni estrato un servicio no medido de uso comercial', async () => {
    await open([tariff()]);

    actions.select('SANITATION');
    await settle();
    context.http
      .expectOne(SANITATION_URL)
      .flush([tariff({ serviceType: 'SANITATION', blocks: [], adjustments: [] })]);
    await settle();
    actions.usage.set('COMMERCIAL');
    actions.simulate();
    context.http
      .expectOne(`${TARIFFS_URL}/estimate?serviceType=SANITATION&consumption=0&usage=COMMERCIAL`)
      .flush({ ...charge, adjustment: 0, blocks: [] });
    await settle();

    expect(textOf(element)).not.toContain('Subsidio (');
  });

  it('avisa si no hay tarifa vigente para simular', async () => {
    await open([tariff()]);

    actions.simulate();
    context.http
      .expectOne((request) => request.url === `${TARIFFS_URL}/estimate`)
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();

    expect(document.body.textContent).toContain('Este servicio aún no tiene una tarifa vigente');
  });

  it('elimina una tarifa programada', async () => {
    const next = tariff({ id: 'next', validFrom: '2027-01-01', inEffect: false });
    await open([next, tariff()]);

    actions.remove(next);
    const request = context.http.expectOne(`${TARIFFS_URL}/next`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await settle();
    context.http.expectOne(WATER_URL).flush([tariff()]);
    await settle();

    expect(document.body.textContent).toContain('Tarifa programada eliminada');
    expect(textOf(element)).not.toContain('Empieza el');
  });

  it('no elimina si se cancela o si la tarifa ya está vigente', async () => {
    await open([tariff()]);

    confirmed = false;
    actions.remove(tariff());
    context.http.expectNone(`${TARIFFS_URL}/${tariff().id}`);

    confirmed = true;
    actions.remove(tariff());
    context.http
      .expectOne(`${TARIFFS_URL}/${tariff().id}`)
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();

    expect(document.body.textContent).toContain('La tarifa ya está vigente');
  });

  it('informa si las tarifas no cargan', async () => {
    await open(null);

    expect(textOf(element)).toContain('No pudimos cargar las tarifas');
  });
});
