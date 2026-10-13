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
}

describe('CollectionsReport', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<CollectionsReport>;
  let element: HTMLElement;
  let actions: Actions;

  afterEach(() => {
    context.http.verify();
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
    await open();
    expectCollections(TODAY, TODAY).flush(report([payment()]));
    await settle();
    expect(textOf(element)).toContain('1 pago');

    button('Este mes')?.click();
    await settle();
    expectCollections(`${TODAY.slice(0, 8)}01`, TODAY).flush(report([]));
    await settle();
    expect(textOf(element)).toContain('No se registraron pagos en estas fechas');

    // Si hoy es día 1, «Este mes» y «Hoy» son el mismo rango y no hay nueva consulta
    button('Hoy')?.click();
    await settle();
    context.http
      .match((request) => request.url === COLLECTIONS_URL)
      .forEach((request) => request.flush(report([])));
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
