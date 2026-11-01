import { TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { INVOICE_ID } from '../../../../testing/billing-fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { CollectionEntry, Collections, isoDate, REPORTS_URL } from '../report.models';
import { CollectionsReport } from './collections-report';

const COLLECTIONS_URL = `${REPORTS_URL}/collections`;
const TODAY = isoDate(new Date());

function payment(overrides: Partial<CollectionEntry> = {}): CollectionEntry {
  return {
    invoiceId: INVOICE_ID,
    number: 12,
    subscriberCode: 42,
    subscriberName: 'María Gómez',
    serviceType: 'WATER',
    year: 2026,
    month: 10,
    method: 'CASH',
    paidAt: '2026-10-12T15:00:00Z',
    amount: 25500,
    ...overrides,
  };
}

function report(payments: CollectionEntry[]): Collections {
  const sum = (method: string) =>
    payments
      .filter((entry) => entry.method === method)
      .reduce((total, entry) => total + entry.amount, 0);
  return { cash: sum('CASH'), bank: sum('BANK'), total: sum('CASH') + sum('BANK'), payments };
}

interface Actions {
  from: WritableSignal<string>;
  to: WritableSignal<string>;
  rangesMonth: WritableSignal<string>;
  rangesService: WritableSignal<string>;
}

describe('CollectionsReport', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<CollectionsReport>;
  let element: HTMLElement;
  let actions: Actions;

  afterEach(() => {
    context.http.verify();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function open(): Promise<void> {
    context = setUpPage();
    fixture = TestBed.createComponent(CollectionsReport);
    element = fixture.nativeElement;
    actions = fixture.componentInstance as unknown as Actions;
    await settle();
  }

  function expectCollections(from: string, to: string): TestRequest {
    return context.http.expectOne(
      (request) =>
        request.url === COLLECTIONS_URL &&
        request.params.get('from') === from &&
        request.params.get('to') === to,
    );
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      textOf(candidate).includes(label),
    );
  }

  /** Captura el nombre con el que se descargaría un archivo. */
  function captureDownloads(): { names: string[] } {
    const captured = { names: [] as string[] };
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:file', revokeObjectURL: () => undefined });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      captured.names.push(this.download);
    });
    return captured;
  }

  it('muestra el recaudo de hoy con los totales por medio de pago', async () => {
    await open();
    expectCollections(TODAY, TODAY).flush(
      report([
        payment(),
        payment({ invoiceId: 'other', number: 13, method: 'BANK', amount: 40000 }),
      ]),
    );
    await settle();
    const text = textOf(element);

    expect(text).toContain('Efectivo$25,500');
    expect(text).toContain('Banco$40,000');
    expect(text).toContain('Total recaudado$65,500');
    expect(text).toContain('2 pagos');
    expect(text).toContain('María Gómez');
    expect(text).toContain('Octubre 2026');
    expect(element.querySelector(`a[href="/facturas/${INVOICE_ID}"]`)).not.toBeNull();
  });

  it('cambia el rango con los atajos y avisa si no hay pagos', async () => {
    // Fecha fija a mitad de mes: el día 1, «Este mes» y «Hoy» son el mismo rango y no hay nueva consulta
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    await open();
    expectCollections('2026-10-15', '2026-10-15').flush(report([payment()]));
    await settle();
    expect(textOf(element)).toContain('1 pago');

    button('Este mes')?.click();
    await settle();
    expectCollections('2026-10-01', '2026-10-15').flush(report([]));
    await settle();
    expect(textOf(element)).toContain('No se registraron pagos en estas fechas');

    button('Hoy')?.click();
    await settle();
    expectCollections('2026-10-15', '2026-10-15').flush(report([]));
  });

  it('no consulta con un rango inválido', async () => {
    await open();
    expectCollections(TODAY, TODAY).flush(report([]));

    actions.from.set('2026-10-20');
    actions.to.set('2026-10-01');
    await settle();

    context.http.expectNone(COLLECTIONS_URL);
    expect(textOf(element)).toContain('«Desde» no puede ser posterior a «Hasta»');
    expect(button('Recaudo para Excel')?.disabled).toBe(true);
  });

  it('muestra el consumo por rango de tarifa del mes y el servicio elegidos', async () => {
    await open();
    expectCollections(TODAY, TODAY).flush(report([]));
    await settle();
    const rangesUrl = `${REPORTS_URL}/consumption-ranges`;
    const [year, month] = TODAY.split('-').map(Number);

    button('Ver consumo por rango')?.click();
    await settle();
    const request = context.http.expectOne((candidate) => candidate.url === rangesUrl);
    expect(request.request.params.get('year')).toBe(String(year));
    expect(request.request.params.get('month')).toBe(String(month));
    expect(request.request.params.get('serviceType')).toBe('WATER');
    request.flush([
      {
        from: 0,
        upTo: 0,
        pricePerUnit: null,
        subscribers: 2,
        invoices: 2,
        consumption: 0,
        charge: 0,
      },
      {
        from: 0,
        upTo: 10,
        pricePerUnit: 1000,
        subscribers: 5,
        invoices: 6,
        consumption: 40,
        charge: 40000,
      },
      {
        from: 10,
        upTo: null,
        pricePerUnit: 1500,
        subscribers: 2,
        invoices: 2,
        consumption: 50,
        charge: 60000,
      },
    ]);
    await settle();
    const text = textOf(element);

    expect(text).toContain('Sin consumo');
    expect(text).toContain('Más de 0 y hasta 10 m³');
    expect(text).toContain('Más de 10 m³');
    expect(text).toContain('6 (60 %)');
    expect(text).toContain('40 m³');
    expect(text).toContain('$60,000 (60 %)');

    // Sin facturas en el periodo lo dice; si falla deja reintentar
    actions.rangesMonth.set('2026-01');
    await settle();
    context.http
      .expectOne(
        (candidate) => candidate.url === rangesUrl && candidate.params.get('month') === '1',
      )
      .flush([
        {
          from: 0,
          upTo: 0,
          pricePerUnit: null,
          subscribers: 0,
          invoices: 0,
          consumption: 0,
          charge: 0,
        },
      ]);
    await settle();
    expect(textOf(element)).toContain('No hay facturas de ese servicio en el periodo');

    actions.rangesService.set('ELECTRICITY');
    await settle();
    context.http
      .expectOne((candidate) => candidate.params.get('serviceType') === 'ELECTRICITY')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(textOf(element)).toContain('No pudimos cargar el consumo por rango');
  });

  it('muestra los mayores deudores solo cuando se piden', async () => {
    await open();
    expectCollections(TODAY, TODAY).flush(report([]));
    await settle();
    const debtorsUrl = `${REPORTS_URL}/top-debtors`;

    button('Ver los 10 que más deben')?.click();
    await settle();
    context.http.expectOne(debtorsUrl).flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(textOf(element)).toContain('No pudimos cargar los deudores');

    button('Reintentar')?.click();
    await settle();
    context.http.expectOne(debtorsUrl).flush([
      {
        subscriberId: 'a',
        subscriberCode: 42,
        subscriberName: 'María Gómez',
        invoices: 2,
        amount: 90000,
        overdueAmount: 43500,
      },
      {
        subscriberId: 'b',
        subscriberCode: 7,
        subscriberName: 'Pedro Rojas',
        invoices: 1,
        amount: 18000,
        overdueAmount: 0,
      },
    ]);
    await settle();
    const text = textOf(element);

    expect(text).toContain('María Gómez');
    expect(text).toContain('2 facturas · vencido $43,500');
    expect(text).toContain('$90,000');
    expect(text).toContain('Pedro Rojas');
    expect(text).toContain('1 factura');
    expect(element.querySelector('a[href="/facturas?suscriptor=a"]')).not.toBeNull();
  });

  it('avisa cuando nadie debe', async () => {
    await open();
    expectCollections(TODAY, TODAY).flush(report([]));
    await settle();

    button('Ver los 10 que más deben')?.click();
    await settle();
    context.http.expectOne(`${REPORTS_URL}/top-debtors`).flush([]);
    await settle();

    expect(textOf(element)).toContain('Nadie debe');
  });

  it('muestra los pagos reversados solo cuando se piden', async () => {
    await open();
    expectCollections(TODAY, TODAY).flush(report([]));
    await settle();
    const reversalsUrl = `${REPORTS_URL}/payment-reversals`;
    context.http.expectNone((request) => request.url === reversalsUrl);

    button('Ver los de estas fechas')?.click();
    await settle();
    context.http
      .expectOne((request) => request.url === reversalsUrl && request.params.get('from') === TODAY)
      .flush([
        {
          invoiceId: INVOICE_ID,
          number: 12,
          method: 'CASH',
          paidAt: '2026-10-12T15:00:00Z',
          reason: 'Se cobró al predio equivocado',
          reversedAt: '2026-10-12T16:00:00Z',
        },
      ]);
    await settle();
    expect(textOf(element)).toContain('Factura n.º 12');
    expect(textOf(element)).toContain('Se cobró al predio equivocado');
    expect(textOf(element)).toContain('Se deshizo un pago en efectivo');

    // Al cambiar las fechas se vuelven a consultar; sin reversos lo dice, y si falla deja reintentar
    button('Este mes')?.click();
    await settle();
    context.http
      .match((request) => request.url === COLLECTIONS_URL)
      .forEach((request) => request.flush(report([])));
    context.http
      .match((request) => request.url === reversalsUrl)
      .forEach((request) => request.flush([]));
    await settle();
    actions.from.set('2026-01-01');
    actions.to.set('2026-01-31');
    await settle();
    expectCollections('2026-01-01', '2026-01-31').flush(report([]));
    context.http.expectOne((request) => request.url === reversalsUrl).flush([]);
    await settle();
    expect(textOf(element)).toContain('No se reversó ningún pago en estas fechas');

    actions.to.set('2026-02-15');
    await settle();
    expectCollections('2026-01-01', '2026-02-15').flush(report([]));
    context.http
      .expectOne((request) => request.url === reversalsUrl)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(textOf(element)).toContain('No pudimos cargar los pagos reversados');
  });

  it('descarga el recaudo y la cartera para Excel', async () => {
    await open();
    expectCollections(TODAY, TODAY).flush(report([payment()]));
    await settle();
    const downloads = captureDownloads();

    button('Recaudo para Excel')?.click();
    context.http
      .expectOne(`${COLLECTIONS_URL}/export?from=${TODAY}&to=${TODAY}`)
      .flush(new Blob(['csv']));
    button('Cartera para Excel')?.click();
    context.http.expectOne(`${REPORTS_URL}/debts/export`).flush(new Blob(['csv']));

    expect(downloads.names).toEqual([`recaudo-${TODAY}-a-${TODAY}.csv`, `cartera-${TODAY}.csv`]);
  });

  it('informa si el recaudo o una descarga fallan', async () => {
    await open();
    expectCollections(TODAY, TODAY).flush(null, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(textOf(element)).toContain('No pudimos cargar el recaudo');
    const downloads = captureDownloads();

    button('Cartera para Excel')?.click();
    context.http
      .expectOne(`${REPORTS_URL}/debts/export`)
      .flush(new Blob(), { status: 500, statusText: 'Server Error' });
    await settle();

    expect(downloads.names).toEqual([]);
    expect(document.body.querySelector('.mat-mdc-snack-bar-label')).not.toBeNull();
  });
});
