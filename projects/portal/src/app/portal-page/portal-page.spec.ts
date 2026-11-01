import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { settle, textOf } from '../../testing/setup';
import { App } from '../app';
import { routes } from '../app.routes';
import { PortalInvoice, PortalStatement } from '../portal.models';
import { PORTAL_URL, PortalPage } from './portal-page';

const TOKEN = 'kX9v2mQ7pL4sT8wZ1aB3cD5eF6gH0jKlMnOpQrStUvW';
const STATEMENT_URL = `${PORTAL_URL}/${TOKEN}`;

function invoice(overrides: Partial<PortalInvoice> = {}): PortalInvoice {
  return {
    id: 'invoice-1',
    number: 12,
    year: 2026,
    month: 10,
    serviceType: 'WATER',
    consumption: 15,
    total: 25500,
    dueDate: '2026-11-20',
    state: 'PENDING',
    paidAt: null,
    ...overrides,
  };
}

function statement(invoices: PortalInvoice[]): PortalStatement {
  return {
    organizationName: 'Acueducto El Hato',
    subscriberCode: 42,
    subscriberName: 'María Gómez',
    invoices,
    claims: [],
  };
}

describe('PortalPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PortalPage>;
  let element: HTMLElement;

  beforeAll(() => registerLocaleData(localeEsCo));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(): Promise<void> {
    fixture = TestBed.createComponent(PortalPage);
    fixture.componentRef.setInput('token', TOKEN);
    element = fixture.nativeElement;
    await settle();
  }

  async function load(invoices: PortalInvoice[]): Promise<void> {
    await open();
    expect(textOf(element)).toContain('Cargando tus facturas');
    http.expectOne(STATEMENT_URL).flush(statement(invoices));
    await settle();
  }

  function fill(selector: string, value: string): void {
    const field = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    field!.value = value;
    field!.dispatchEvent(new Event('input'));
  }

  async function writeClaim(): Promise<void> {
    await load([invoice()]);
    element.querySelector<HTMLElement>('.claims > button')?.click();
    await settle();
    fill('input[formcontrolname=cause]', '  Corte de agua ');
    fill('textarea[formcontrolname=description]', 'Llevo dos días sin servicio');
  }

  function submit(): void {
    element.querySelector<HTMLFormElement>('.claim-form')?.dispatchEvent(new Event('submit'));
  }

  it('radica una PQR, confirma su número y la muestra en la lista', async () => {
    await writeClaim();
    submit();

    const request = http.expectOne(`${STATEMENT_URL}/claims`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      type: 'PETITION',
      cause: 'Corte de agua',
      description: 'Llevo dos días sin servicio',
      invoiceId: null,
    });
    const filed = {
      number: 7,
      type: 'PETITION' as const,
      state: 'OPEN' as const,
      filedOn: '2026-11-01',
      dueDate: '2026-11-24',
    };
    request.flush(filed);
    await settle();
    http.expectOne(STATEMENT_URL).flush({ ...statement([invoice()]), claims: [filed] });
    await settle();

    expect(textOf(element)).toContain('con el número 7');
    expect(textOf(element)).toContain('Petición n.º 7');
    expect(textOf(element)).toContain('En trámite');
    expect(element.querySelector('.claim-form')).toBeNull();
  });

  it('en un reclamo deja elegir la factura y no envía nada sin motivo', async () => {
    await writeClaim();
    const type = element.querySelector<HTMLSelectElement>('select[formcontrolname=type]');
    type!.selectedIndex = 2;
    type!.dispatchEvent(new Event('change'));
    await settle();
    expect(textOf(element)).toContain('La oficina revisará el valor en reclamo');
    const bill = element.querySelector<HTMLSelectElement>('select[formcontrolname=invoiceId]');
    bill!.selectedIndex = 1;
    bill!.dispatchEvent(new Event('change'));

    fill('input[formcontrolname=cause]', '   ');
    submit();
    await settle();
    http.expectNone(`${STATEMENT_URL}/claims`);
    expect(textOf(element)).toContain('Escribe el motivo y la descripción');

    fill('input[formcontrolname=cause]', 'Cobro indebido');
    submit();
    const request = http.expectOne(`${STATEMENT_URL}/claims`);
    expect(request.request.body.type).toBe('CLAIM');
    expect(request.request.body.invoiceId).toBe('invoice-1');
    request.flush({
      number: 8,
      type: 'CLAIM',
      state: 'OPEN',
      filedOn: '2026-11-01',
      dueDate: '2026-11-24',
    });
    await settle();
    http.expectOne(STATEMENT_URL).flush(statement([invoice()]));
    await settle();
  });

  it('explica si ya no puede radicar más hoy, y conserva lo escrito', async () => {
    await writeClaim();
    submit();

    http
      .expectOne(`${STATEMENT_URL}/claims`)
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable Content' });
    await settle();

    expect(textOf(element)).toContain('Ya radicaste varias PQR hoy');
    expect(element.querySelector<HTMLTextAreaElement>('textarea')?.value).toContain('dos días');
  });

  async function fail(status: number): Promise<void> {
    await open();
    http.expectOne(STATEMENT_URL).flush(null, { status, statusText: 'Error' });
    await settle();
  }

  it('muestra lo que se debe y cada factura con su PDF', async () => {
    await load([
      invoice({ id: 'overdue', number: 13, month: 11, total: 40000, state: 'OVERDUE' }),
      invoice(),
      invoice({ id: 'carried', number: 11, month: 9, state: 'CARRIED' }),
      invoice({ id: 'paid', number: 10, month: 8, state: 'PAID', paidAt: '2026-09-05T15:00:00Z' }),
    ]);
    const text = textOf(element);

    expect(text).toContain('Acueducto El Hato');
    expect(text).toContain('María Gómez');
    expect(text).toContain('Código de suscriptor 42');
    // Las incluidas en la siguiente no se suman: su valor ya va en esa
    expect(text).toContain('Tienes 2 facturas por pagar');
    expect(text).toMatch(/\$\s?65\.500/);
    expect(text).toContain('Noviembre 2026');
    expect(text).toContain('Acueducto · Factura n.º 13');
    expect(text).toContain('Consumo: 15 m³');
    expect(text).toContain('Vencida');
    expect(text).toContain('Paga hasta el 20 de noviembre de 2026');
    expect(text).toContain('Su valor está incluido en la factura siguiente');
    expect(text).toContain('Pagada el 5 de septiembre de 2026');
    expect(element.querySelector(`a[href="${STATEMENT_URL}/invoices/overdue/pdf"]`)).not.toBeNull();
    expect(element.querySelectorAll('.invoice')).toHaveLength(4);
  });

  it('con una sola factura pendiente lo dice en singular, y sin medidor no muestra consumo', async () => {
    await load([
      invoice({ serviceType: 'SANITATION', consumption: 0, total: 12000 }),
      invoice({
        id: 'power',
        serviceType: 'ELECTRICITY',
        state: 'PAID',
        paidAt: '2026-10-02T15:00:00Z',
      }),
    ]);
    const text = textOf(element);

    expect(text).toContain('Tienes 1 factura por pagar');
    expect(text).toContain('Aseo · Factura n.º 12');
    expect(text).toContain('Consumo: 15 kWh');
    expect(text).not.toContain('Consumo: 0');
  });

  it('avisa cuando está al día y cuando aún no hay facturas', async () => {
    await load([invoice({ state: 'PAID', paidAt: '2026-10-12T15:00:00Z' })]);
    expect(textOf(element)).toContain('Estás al día');
    expect(textOf(element)).toContain('Pagada');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });
    http = TestBed.inject(HttpTestingController);

    await load([]);
    expect(textOf(element)).toContain('Estás al día');
    expect(textOf(element)).toContain('Todavía no tienes facturas');
  });

  it('explica cuando el enlace ya no es válido', async () => {
    await fail(404);

    expect(textOf(element)).toContain('Este enlace ya no es válido');
    expect(element.querySelector('button')).toBeNull();
  });

  it('deja reintentar si hay demasiadas consultas o falla la conexión', async () => {
    await fail(429);
    expect(textOf(element)).toContain('Demasiadas consultas');

    element.querySelector('button')?.click();
    await settle();
    http.expectOne(STATEMENT_URL).flush(null, { status: 503, statusText: 'Unavailable' });
    await settle();
    expect(textOf(element)).toContain('No pudimos cargar tus facturas');

    element.querySelector('button')?.click();
    await settle();
    http.expectOne(STATEMENT_URL).flush(statement([invoice()]));
    await settle();
    expect(textOf(element)).toContain('María Gómez');
  });
});

describe('Rutas del portal', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes, withComponentInputBinding()),
      ],
    });
  });

  it('la dirección del QR abre la página del suscriptor con su token', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/p/${TOKEN}`, PortalPage);
    await settle();

    TestBed.inject(HttpTestingController).expectOne(STATEMENT_URL).flush(statement([]));
  });

  it('cualquier otra dirección pide abrir el enlace de la factura', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    expect(textOf(harness.routeNativeElement as HTMLElement)).toContain(
      'Abre el enlace de tu factura',
    );
    expect(
      TestBed.createComponent(App).nativeElement.querySelector('router-outlet'),
    ).not.toBeNull();
  });
});
