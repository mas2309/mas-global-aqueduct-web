import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { access, authResponse, organization } from '../../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import {
  property,
  PROPERTY_ID,
  subscriber,
  SUBSCRIBER_ID,
} from '../../../../testing/subscriber-fixtures';
import { PLANS_URL } from '../../invoices/invoices-api';
import { ServiceType } from '../../organizations/organization.models';
import { Property, PropertyService, Subscriber } from '../subscriber.models';
import { CURRENT_ORGANIZATION_URL, PROPERTIES_URL, SUBSCRIBERS_URL } from '../subscribers-api';
import { SubscriberDetail } from './subscriber-detail';

const SUBSCRIBER_URL = `${SUBSCRIBERS_URL}/${SUBSCRIBER_ID}`;
const SUBSCRIBER_PROPERTIES_URL = `${SUBSCRIBER_URL}/properties`;
const SERVICE_URL = `${PROPERTIES_URL}/${PROPERTY_ID}/services`;

const water: PropertyService = {
  serviceType: 'WATER',
  meterSerial: 'MED-001',
  status: 'ACTIVE',
  connectedAt: '2026-10-01T00:00:00Z',
};

interface Actions {
  connect: (property: Property, service: ServiceType) => void;
  openMeter: (property: Property, service: ServiceType, connection?: PropertyService) => void;
  act: (property: Property, service: ServiceType, action: string, title: string) => void;
  disconnect: (property: Property, service: ServiceType) => void;
  openProperty: (property?: Property) => void;
  changeStatus: (subscriber: Subscriber) => void;
}

describe('SubscriberDetail', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<SubscriberDetail>;
  let element: HTMLElement;
  let actions: Actions;
  /** Lo que devuelve el diálogo abierto (confirmación o entidad guardada). */
  let dialogResult: unknown;

  afterEach(() => context.http.verify());

  async function open(
    properties: Property[],
    options: { role?: 'OPERATOR' | 'VIEWER'; person?: Subscriber } = {},
  ): Promise<void> {
    dialogResult = true;
    context = setUpPage({
      session: authResponse({ organization: access({ role: options.role ?? 'OPERATOR' }) }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(SubscriberDetail);
    fixture.componentRef.setInput('id', SUBSCRIBER_ID);
    element = fixture.nativeElement;
    actions = fixture.componentInstance as unknown as Actions;
    await settle();
    context.http.expectOne(SUBSCRIBER_URL).flush(options.person ?? subscriber());
    context.http.expectOne(SUBSCRIBER_PROPERTIES_URL).flush(properties);
    context.http
      .expectOne(CURRENT_ORGANIZATION_URL)
      .flush(organization({ services: ['WATER', 'SANITATION'] }));
    await settle();
    // La ficha incluye las financiaciones del suscriptor
    context.http.expectOne(`${PLANS_URL}?subscriberId=${SUBSCRIBER_ID}`).flush([]);
    context.http.expectOne(`/api/v1/connection-fees?subscriberId=${SUBSCRIBER_ID}`).flush([]);
    context.http
      .expectOne(`${SUBSCRIBER_URL}/portal-link`)
      .flush({ url: 'https://portal.test/p/token' });
    await settle();
  }

  async function expectReload(properties: Property[]): Promise<void> {
    await settle();
    context.http.expectOne(SUBSCRIBER_PROPERTIES_URL).flush(properties);
    await settle();
  }

  it('muestra los datos, los predios y los servicios que ofrece el prestador', async () => {
    await open([property({ services: [water] })]);
    const text = textOf(element);

    expect(text).toContain('María Gómez');
    expect(text).toContain('Código 000042');
    expect(text).toContain('Cédula de ciudadanía 52123456');
    expect(text).toContain('Vereda El Hato, casa 12');
    expect(text).toContain('Residencial · Estrato 2');
    expect(text).toContain('Medidor MED-001');
    expect(text).toContain('Aseo');
    expect(text).toContain('No conectado');
    expect(text).not.toContain('Gas natural');
  });

  it('invita a agregar el primer predio', async () => {
    await open([]);

    expect(textOf(element)).toContain('aún no tiene predios');
  });

  it('agrega y edita predios desde el diálogo', async () => {
    await open([]);
    dialogResult = property();

    actions.openProperty();
    await expectReload([property()]);
    expect(document.body.textContent).toContain('Predio agregado');

    actions.openProperty(property());
    await expectReload([property()]);
    expect(document.body.textContent).toContain('Predio actualizado');
  });

  it('conecta de una vez un servicio sin medidor', async () => {
    await open([property()]);

    actions.connect(property(), 'SANITATION');
    const request = context.http.expectOne(`${SERVICE_URL}/SANITATION`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ meterSerial: null });
    request.flush(property());
    await expectReload([property()]);

    expect(document.body.textContent).toContain('Aseo conectado');
  });

  it('pide el medidor para los servicios medidos', async () => {
    await open([property()]);
    dialogResult = property({ services: [water] });

    actions.connect(property(), 'WATER');
    await expectReload([property({ services: [water] })]);
    expect(document.body.textContent).toContain('Acueducto conectado');

    actions.openMeter(property(), 'WATER', water);
    await expectReload([property({ services: [water] })]);
    expect(document.body.textContent).toContain('Medidor actualizado');
  });

  it('registra la suspensión, muestra el corte y retira un servicio', async () => {
    const connected = property({ services: [water] });
    await open([connected]);

    actions.act(connected, 'WATER', 'SUSPEND', 'Suspender');
    await expectReload([property({ services: [{ ...water, status: 'SUSPENDED' }] })]);
    expect(textOf(element)).toContain('Suspendido');
    expect(document.body.textContent).toContain('Registrado: suspender acueducto');

    actions.act(connected, 'WATER', 'CUT', 'Cortar');
    await expectReload([property({ services: [{ ...water, status: 'CUT' }] })]);
    expect(textOf(element)).toContain('Cortado');

    actions.disconnect(connected, 'WATER');
    const request = context.http.expectOne(`${SERVICE_URL}/WATER`);
    expect(request.request.method).toBe('DELETE');
    request.flush(property());
    await expectReload([property()]);
    expect(document.body.textContent).toContain('Servicio retirado del predio');
  });

  it('no hace nada si se cancela una confirmación', async () => {
    const connected = property({ services: [water] });
    await open([connected]);
    dialogResult = false;

    actions.act(connected, 'WATER', 'SUSPEND', 'Suspender');
    actions.changeStatus(subscriber());
    await settle();

    context.http.expectNone(`${SERVICE_URL}/WATER/suspend`);
    context.http.expectNone(`${SUBSCRIBER_URL}/deactivate`);
  });

  it('desactiva y reactiva al suscriptor', async () => {
    await open([]);

    actions.changeStatus(subscriber());
    context.http
      .expectOne(`${SUBSCRIBER_URL}/deactivate`)
      .flush(subscriber({ status: 'INACTIVE' }));
    await settle();
    expect(textOf(element)).toContain('Inactivo');
    expect(textOf(element)).not.toContain('Agregar predio');

    actions.changeStatus(subscriber({ status: 'INACTIVE' }));
    context.http.expectOne(`${SUBSCRIBER_URL}/activate`).flush(subscriber());
    await settle();
    expect(textOf(element)).toContain('Agregar predio');
  });

  it('avisa si una operación es rechazada', async () => {
    await open([property()]);

    actions.connect(property(), 'SANITATION');
    context.http
      .expectOne(`${SERVICE_URL}/SANITATION`)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(document.body.textContent).toContain('Tu rol solo permite consultar');
  });

  it('el rol de consulta solo ve la información', async () => {
    await open([property({ services: [water] })], { role: 'VIEWER' });
    const text = textOf(element);

    expect(text).toContain('Medidor MED-001');
    expect(text).not.toContain('Editar');
    expect(text).not.toContain('Agregar predio');
    expect(text).not.toContain('Conectar');
  });

  it('informa si el suscriptor no existe', async () => {
    context = setUpPage();
    fixture = TestBed.createComponent(SubscriberDetail);
    fixture.componentRef.setInput('id', SUBSCRIBER_ID);
    await settle();
    context.http.expectOne(SUBSCRIBER_URL).flush(null, { status: 404, statusText: 'Not Found' });
    context.http
      .expectOne(SUBSCRIBER_PROPERTIES_URL)
      .flush(null, { status: 404, statusText: 'Not Found' });
    context.http.expectOne(CURRENT_ORGANIZATION_URL).flush(organization());
    await settle();

    expect(textOf(fixture.nativeElement)).toContain('No encontramos este suscriptor');
  });
});
