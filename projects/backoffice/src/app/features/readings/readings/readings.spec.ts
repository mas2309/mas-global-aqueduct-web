import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import {
  invoice,
  period,
  PERIOD_ID,
  reading,
  routeEntry,
  tariff,
} from '../../../../testing/billing-fixtures';
import { access, authResponse, organization } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { Invoice } from '../../invoices/invoice.models';
import { ServiceType } from '../../organizations/organization.models';
import { CURRENT_ORGANIZATION_URL } from '../../subscribers/subscribers-api';
import { Tariff } from '../../tariffs/tariff.models';
import { TARIFFS_URL } from '../../tariffs/tariffs-api';
import { OpenPeriodDialog } from '../open-period-dialog/open-period-dialog';
import { BillingPeriod, Reading, RouteEntry } from '../reading.models';
import { PERIODS_URL } from '../readings-api';
import { Readings } from './readings';

const ROUTE_URL = `${PERIODS_URL}/${PERIOD_ID}/route?serviceType=WATER`;
const INVOICES_OF_PERIOD_URL = `${PERIODS_URL}/${PERIOD_ID}/invoices`;
const OTHER_PROPERTY = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const pending = routeEntry();
const read = routeEntry({
  propertyId: OTHER_PROPERTY,
  subscriberCode: 7,
  subscriberName: 'Pedro Rojas',
  sector: 'La Esperanza',
  meterSerial: 'MED-777',
  reading: reading({ propertyId: OTHER_PROPERTY, consumption: 40, unusual: true }),
});

interface Actions {
  openPeriod: () => void;
  closePeriod: (period: BillingPeriod) => void;
  onChanged: (entry: RouteEntry, reading: Reading | null) => void;
  searchText: WritableSignal<string>;
  onlyPending: WritableSignal<boolean>;
}

describe('Readings', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<Readings>;
  let element: HTMLElement;
  let actions: Actions;
  /** Lo que devuelve el diálogo abierto: confirmación o primer periodo. */
  let dialogResult: unknown;

  afterEach(() => context.http.verify());

  async function open(
    periods: BillingPeriod[] | null,
    route: RouteEntry[] | null = [pending, read],
    options: {
      role?: OrganizationRole;
      services?: ServiceType[];
      tariffs?: Tariff[];
      invoices?: Invoice[];
    } = {},
  ): Promise<void> {
    dialogResult = true;
    context = setUpPage({
      session: authResponse({ organization: access({ role: options.role ?? 'ORG_ADMIN' }) }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(Readings);
    element = fixture.nativeElement;
    actions = fixture.componentInstance as unknown as Actions;
    await settle();
    context.http
      .expectOne(CURRENT_ORGANIZATION_URL)
      .flush(organization({ services: options.services ?? ['WATER', 'SANITATION'] }));
    const request = context.http.expectOne(PERIODS_URL);
    if (periods) {
      request.flush(periods);
    } else {
      request.flush(null, { status: 500, statusText: 'Server Error' });
    }
    await settle();
    await settle();
    const metered = (options.services ?? ['WATER']).includes('WATER');
    if (metered) {
      context.http
        .expectOne(`${TARIFFS_URL}?serviceType=WATER`)
        .flush(options.tariffs ?? [tariff()]);
    }
    if (periods?.length) {
      context.http.expectOne(INVOICES_OF_PERIOD_URL).flush(options.invoices ?? []);
      if (metered) {
        await flushRoute(route);
      }
    }
    await settle();
  }

  async function flushRoute(route: RouteEntry[] | null): Promise<void> {
    const request = context.http.expectOne(ROUTE_URL);
    if (route) {
      request.flush(route);
    } else {
      request.flush(null, { status: 500, statusText: 'Server Error' });
    }
    await settle();
  }

  it('muestra la ruta del periodo abierto con su avance', async () => {
    await open([period()]);
    const text = textOf(element);

    expect(text).toContain('1 de 2 medidores leídos');
    expect(text).toContain('1 con consumo inusual');
    expect(text).toContain('María Gómez');
    expect(text).toContain('Pedro Rojas');
    expect(text).toContain('Cerrar Octubre 2026');
    expect(element.querySelectorAll('aq-reading-row input').length).toBeGreaterThan(0);
  });

  it('descarga todas las facturas del periodo en un PDF', async () => {
    await open([period()], [pending, read], {
      role: 'VIEWER',
      invoices: [invoice({ propertyId: OTHER_PROPERTY })],
    });
    const createObjectURL = vi.fn(() => 'blob:facturas');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    let fileName = '';
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      fileName = this.download;
    });
    const print = [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      textOf(candidate).includes('Imprimir facturas'),
    );

    print?.click();
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    context.http.expectOne(`${INVOICES_OF_PERIOD_URL}/pdf`).flush(pdf);
    expect(createObjectURL).toHaveBeenCalledWith(pdf);
    expect(fileName).toBe('facturas-2026-10.pdf');

    print?.click();
    context.http
      .expectOne(`${INVOICES_OF_PERIOD_URL}/pdf`)
      .flush(new Blob(), { status: 422, statusText: 'Unprocessable' });
    await settle();
    expect(anchorClick).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    anchorClick.mockRestore();
  });

  it('sin tarifa vigente no deja digitar y lleva a definirla', async () => {
    await open([period()], [pending], { tariffs: [tariff({ inEffect: false })] });

    expect(textOf(element)).toContain('Acueducto no tiene una tarifa vigente');
    expect(element.querySelector('a[href="/tarifas?servicio=WATER"]')).not.toBeNull();
    expect(element.querySelector('aq-reading-row input')).toBeNull();
  });

  it('filtra por texto y por pendientes', async () => {
    await open([period()]);

    actions.searchText.set('med-777');
    await settle();
    expect(textOf(element)).toContain('Pedro Rojas');
    expect(textOf(element)).not.toContain('María Gómez');

    actions.onlyPending.set(true);
    await settle();
    expect(textOf(element)).toContain('Ningún medidor coincide con el filtro');

    actions.searchText.set('hato');
    await settle();
    expect(textOf(element)).toContain('María Gómez');
  });

  it('actualiza el avance cuando una fila guarda o elimina su lectura', async () => {
    await open([period()]);

    actions.onChanged(pending, reading());
    await settle();
    // La lectura generó su factura: se trae y se muestra en la fila
    context.http.expectOne(INVOICES_OF_PERIOD_URL).flush([invoice()]);
    await settle();
    expect(textOf(element)).toContain('2 de 2 medidores leídos');
    expect(textOf(element)).toContain('Facturado $25,500');
    expect(element.querySelector('aq-reading-row a.bill')?.getAttribute('href')).toBe(
      `/facturas/${invoice().id}`,
    );

    actions.onChanged(read, null);
    await settle();
    context.http.expectOne(INVOICES_OF_PERIOD_URL).flush([invoice()]);
    await settle();
    expect(textOf(element)).toContain('1 de 2 medidores leídos');
    expect(textOf(element)).not.toContain('con consumo inusual');
  });

  it('un periodo cerrado es de solo consulta y permite abrir el siguiente', async () => {
    await open([period({ status: 'CLOSED', closedAt: '2026-11-01T00:00:00Z' })]);

    expect(textOf(element)).toContain('Periodo cerrado: solo consulta');
    expect(element.querySelector('aq-reading-row input')).toBeNull();
    expect(textOf(element)).toContain('Abrir Noviembre 2026');

    actions.openPeriod();
    const request = context.http.expectOne(PERIODS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ year: 2026, month: 11 });
    const opened = period({ id: 'november', month: 11 });
    request.flush(opened);
    await settle();
    context.http
      .expectOne(PERIODS_URL)
      .flush([opened, period({ status: 'CLOSED', closedAt: '2026-11-01T00:00:00Z' })]);
    context.http.expectOne(`${PERIODS_URL}/november/invoices`).flush([]);
    context.http.expectOne(`${PERIODS_URL}/november/route?serviceType=WATER`).flush([pending]);
    await settle();

    expect(document.body.textContent).toContain('Periodo Noviembre 2026 abierto');
    expect(textOf(element)).toContain('0 de 1 medidores leídos');
  });

  it('el primer periodo se elige en un diálogo', async () => {
    await open([]);

    expect(textOf(element)).toContain('Aún no hay periodos de facturación');
    dialogResult = { year: 2026, month: 9, months: 2 };
    click(element, '.state button');
    const request = context.http.expectOne(PERIODS_URL);
    expect(request.request.body).toEqual({ year: 2026, month: 9, months: 2 });
    request.flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(document.body.textContent).toContain('Ese periodo ya existe');
  });

  it('no abre el periodo si se cierra el diálogo sin elegir', async () => {
    await open([]);

    dialogResult = undefined;
    actions.openPeriod();

    context.http.expectNone((request) => request.method === 'POST');
  });

  it('quien no administra no abre ni cierra periodos', async () => {
    await open([], null, { role: 'OPERATOR' });

    expect(textOf(element)).toContain('Pídele al administrador del prestador que lo abra');
    expect(element.querySelector('.state button')).toBeNull();
  });

  it('cierra el periodo avisando cuántos medidores faltan', async () => {
    await open([period()]);
    const dialog = TestBed.inject(MatDialog);
    const openDialog = vi.spyOn(dialog, 'open');

    actions.closePeriod(period());
    expect(openDialog.mock.calls[0][1]?.data).toMatchObject({
      message: expect.stringContaining('Quedan 1 medidores sin lectura'),
    });
    expect(openDialog.mock.calls[0][1]?.data).toMatchObject({
      message: expect.stringContaining('servicios sin medidor'),
    });
    const request = context.http.expectOne(`${PERIODS_URL}/${PERIOD_ID}/close`);
    expect(request.request.method).toBe('POST');
    request.flush(period({ status: 'CLOSED' }));
    await settle();
    context.http.expectOne(PERIODS_URL).flush([period({ status: 'CLOSED' })]);
    await settle();

    expect(document.body.textContent).toContain('Periodo Octubre 2026 cerrado');
    expect(textOf(element)).toContain('Periodo cerrado: solo consulta');
  });

  it('no cierra si se cancela y avisa si el servidor lo rechaza', async () => {
    await open([period()], [read]);

    dialogResult = false;
    actions.closePeriod(period());
    context.http.expectNone(`${PERIODS_URL}/${PERIOD_ID}/close`);

    dialogResult = true;
    actions.closePeriod(period());
    context.http
      .expectOne(`${PERIODS_URL}/${PERIOD_ID}/close`)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(document.body.textContent).toContain(
      'Solo el administrador del prestador abre y cierra periodos',
    );
  });

  it('explica cuando no hay medidores en la ruta', async () => {
    await open([period()], []);

    expect(textOf(element)).toContain('No hay medidores por leer');
  });

  it('explica cuando el prestador no tiene servicios medidos', async () => {
    await open([period()], null, { services: ['SANITATION'] });

    expect(textOf(element)).toContain('Este prestador no ofrece servicios con medidor');
  });

  it('informa si los periodos o la ruta no cargan', async () => {
    await open(null);
    expect(textOf(element)).toContain('No pudimos cargar los periodos');
    TestBed.resetTestingModule();

    await open([period()], null);
    expect(textOf(element)).toContain('No pudimos cargar la ruta de lectura');
  });
});

describe('OpenPeriodDialog', () => {
  it('devuelve el mes y el año elegidos', async () => {
    const dialogRef = { close: vi.fn() };
    const context = setUpPage({ providers: [{ provide: MatDialogRef, useValue: dialogRef }] });
    const fixture = TestBed.createComponent(OpenPeriodDialog);
    const component = fixture.componentInstance as unknown as {
      year: WritableSignal<number>;
      month: WritableSignal<number>;
    };
    await settle();

    component.year.set(1999);
    await settle();
    const confirm = fixture.nativeElement.querySelector(
      'mat-dialog-actions button:last-child',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    component.year.set(2026);
    component.month.set(9);
    await settle();
    confirm.click();

    expect(dialogRef.close).toHaveBeenCalledWith({ year: 2026, month: 9, months: 1 });
    context.http.verify();
  });
});
