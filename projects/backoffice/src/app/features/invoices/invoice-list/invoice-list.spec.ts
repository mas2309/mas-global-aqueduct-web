import { TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { of } from 'rxjs';
import { invoice, INVOICE_ID } from '../../../../testing/billing-fixtures';
import { access, authResponse } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { SUBSCRIBER_ID } from '../../../../testing/subscriber-fixtures';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { Page } from '../../organizations/organization.models';
import { BillingSettingsDialog } from '../billing-settings-dialog/billing-settings-dialog';
import { Invoice, InvoiceState } from '../invoice.models';
import { BILLING_SETTINGS_URL, INVOICES_URL } from '../invoices-api';
import { InvoiceList } from './invoice-list';

const PAY_URL = `${INVOICES_URL}/${INVOICE_ID}/pay`;

function page(items: Invoice[], totalItems = items.length): Page<Invoice> {
  return { items, page: 0, size: 20, totalItems, totalPages: 1 };
}

interface Actions {
  filterBy: (state: InvoiceState | 'ALL') => void;
  filterByYear: (year: number | null) => void;
  changePage: (event: PageEvent) => void;
  openSettings: () => void;
}

describe('InvoiceList', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<InvoiceList>;
  let element: HTMLElement;
  let actions: Actions;
  let dialogResult: unknown;

  afterEach(() => context.http.verify());

  async function open(role: OrganizationRole = 'OPERATOR', suscriptor?: string): Promise<void> {
    dialogResult = true;
    context = setUpPage({
      session: authResponse({ organization: access({ role }) }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(InvoiceList);
    if (suscriptor) {
      fixture.componentRef.setInput('suscriptor', suscriptor);
    }
    element = fixture.nativeElement;
    actions = fixture.componentInstance as unknown as Actions;
    await settle();
  }

  /** La consulta pendiente cuyos parámetros coinciden; `null` exige que el parámetro no vaya. */
  function expectSearch(params: Record<string, string | null> = {}): TestRequest {
    return context.http.expectOne(
      (request) =>
        request.url === INVOICES_URL &&
        Object.entries(params).every(([name, value]) => request.params.get(name) === value),
    );
  }

  async function load(items: Invoice[], totalItems = items.length): Promise<void> {
    expectSearch().flush(page(items, totalItems));
    await settle();
  }

  it('lista las facturas con su periodo, consumo, total y estado', async () => {
    await open();
    expectSearch({ state: null, year: null, q: null, subscriberId: null, page: '0' }).flush(
      page([
        invoice(),
        invoice({ id: 'overdue', number: 11, state: 'OVERDUE' }),
        invoice({ id: 'paid', number: 10, state: 'PAID', paymentMethod: 'CASH' }),
      ]),
    );
    await settle();
    const text = textOf(element);

    expect(text).toContain('María Gómez');
    expect(text).toContain('Octubre 2026');
    expect(text).toContain('15 m³');
    expect(text).toContain('$25,500');
    expect(text).toContain('Pendiente');
    expect(text).toContain('Vencida');
    expect(text).toContain('Pagada');
    expect(element.querySelector(`a[href="/facturas/${INVOICE_ID}"]`)).not.toBeNull();
    // Solo se cobran las pendientes y las vencidas
    expect(element.querySelectorAll('button[aria-label^="Pago en efectivo"]')).toHaveLength(2);
    expect(textOf(element)).not.toContain('Plazo y recargo');
  });

  it('las facturas de servicios sin medidor no muestran consumo', async () => {
    await open();
    await load([invoice({ serviceType: 'SANITATION', readingId: null, consumption: 0 })]);

    expect(textOf(element)).toContain('—');
    expect(textOf(element)).not.toContain('0 m³');
  });

  it('filtra por estado, año y texto, volviendo a la primera página', async () => {
    await open();
    await load([invoice()], 45);

    actions.changePage({ pageIndex: 1, pageSize: 20, length: 45 });
    await settle();
    expectSearch({ page: '1' }).flush(page([invoice()], 45));

    actions.filterBy('OVERDUE');
    await settle();
    expectSearch({ state: 'OVERDUE', page: '0' }).flush(page([invoice()]));

    actions.filterByYear(2025);
    await settle();
    expectSearch({ state: 'OVERDUE', year: '2025' }).flush(page([invoice()]));

    type(element, 'input[type=search]', '  gómez ');
    click(element, 'form.search button[type=submit]');
    await settle();
    expectSearch({ q: 'gómez' }).flush(page([]));
    await settle();
    expect(textOf(element)).toContain('No hay facturas con estos filtros');

    click(element, 'button[aria-label="Limpiar búsqueda"]');
    actions.filterBy('ALL');
    actions.filterByYear(null);
    await settle();
    expectSearch({ q: null, state: null, year: null }).flush(page([invoice()]));
  });

  it('muestra solo las facturas del suscriptor indicado en la URL', async () => {
    await open('OPERATOR', SUBSCRIBER_ID);
    expectSearch({ subscriberId: SUBSCRIBER_ID }).flush(page([invoice()]));
    await settle();

    expect(textOf(element)).toContain('Mostrando solo las facturas de un suscriptor');
  });

  it('descarga para Excel las facturas con los filtros actuales', async () => {
    await open('OPERATOR', SUBSCRIBER_ID);
    expectSearch({ subscriberId: SUBSCRIBER_ID }).flush(page([invoice()]));
    actions.filterBy('OVERDUE');
    actions.filterByYear(2025);
    type(element, 'input[type=search]', 'gómez');
    click(element, 'form.search button[type=submit]');
    await settle();
    expectSearch({ state: 'OVERDUE' }).flush(page([invoice()]));
    const names: string[] = [];
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:file', revokeObjectURL: () => undefined });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    const exportButton = [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => textOf(candidate).includes('Para Excel'),
    );

    exportButton?.click();
    const request = context.http.expectOne(
      (candidate) => candidate.url === `${INVOICES_URL}/export`,
    );
    expect(request.request.params.get('state')).toBe('OVERDUE');
    expect(request.request.params.get('year')).toBe('2025');
    expect(request.request.params.get('q')).toBe('gómez');
    expect(request.request.params.get('subscriberId')).toBe(SUBSCRIBER_ID);
    request.flush(new Blob(['csv']));
    expect(names).toEqual(['facturas.csv']);

    exportButton?.click();
    context.http
      .expectOne((candidate) => candidate.url === `${INVOICES_URL}/export`)
      .flush(new Blob(), { status: 500, statusText: 'Server Error' });
    await settle();
    expect(names).toHaveLength(1);

    vi.unstubAllGlobals();
    anchorClick.mockRestore();
  });

  it('registra el pago y recarga el listado', async () => {
    await open();
    await load([invoice()]);

    click(element, 'button[aria-label^="Pago en efectivo"]');
    const request = context.http.expectOne(PAY_URL);
    expect(request.request.body).toEqual({ method: 'CASH' });
    request.flush(invoice({ state: 'PAID', paymentMethod: 'CASH' }));
    await settle();
    await load([invoice({ state: 'PAID', paymentMethod: 'CASH' })]);

    expect(document.body.textContent).toContain('Pago de la factura n.º 12 registrado');
    expect(element.querySelector('button[aria-label^="Pago"]')).toBeNull();
  });

  it('no paga si se cancela la confirmación y avisa si el servidor lo rechaza', async () => {
    await open();
    await load([invoice()]);

    dialogResult = false;
    click(element, 'button[aria-label^="Pago por banco"]');
    context.http.expectNone(PAY_URL);

    dialogResult = true;
    click(element, 'button[aria-label^="Pago por banco"]');
    const request = context.http.expectOne(PAY_URL);
    expect(request.request.body).toEqual({ method: 'BANK' });
    request.flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();

    expect(document.body.textContent).toContain('cobra la más reciente');
  });

  it('el rol de consulta no cobra y el administrador configura plazo y recargo', async () => {
    await open('VIEWER');
    await load([invoice()]);
    expect(element.querySelector('button[aria-label^="Pago"]')).toBeNull();
    TestBed.resetTestingModule();

    await open('ORG_ADMIN');
    await load([invoice()]);
    expect(textOf(element)).toContain('Plazo y recargo');
    dialogResult = { paymentDueDay: 15, lateFee: 2000 };
    actions.openSettings();
    expect(document.body.textContent).toContain('Configuración guardada');
    dialogResult = undefined;
    actions.openSettings();
  });

  it('informa si las facturas no cargan', async () => {
    await open();
    expectSearch().flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(textOf(element)).toContain('No pudimos cargar las facturas');
  });
});

describe('BillingSettingsDialog', () => {
  const dialogRef = { close: vi.fn() };
  let context: PageTestContext;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function render(): Promise<void> {
    dialogRef.close.mockReset();
    context = setUpPage({ providers: [{ provide: MatDialogRef, useValue: dialogRef }] });
    element = TestBed.createComponent(BillingSettingsDialog).nativeElement;
    await settle();
    context.http.expectOne(BILLING_SETTINGS_URL).flush({ paymentDueDay: 15, lateFee: 2000 });
    await settle();
  }

  it('carga la configuración actual y guarda los cambios', async () => {
    await render();

    expect(
      element.querySelector<HTMLInputElement>('input[formcontrolname=paymentDueDay]')?.value,
    ).toBe('15');
    type(element, 'input[formcontrolname=lateFee]', '3000');
    click(element, 'button[type=submit]');
    const request = context.http.expectOne(BILLING_SETTINGS_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      paymentDueDay: 15,
      lateFee: 3000,
      invoiceNote: null,
      invoiceHeader: null,
    });
    request.flush({ paymentDueDay: 15, lateFee: 3000 });

    expect(dialogRef.close).toHaveBeenCalledWith({ paymentDueDay: 15, lateFee: 3000 });
  });

  it('valida el día y muestra el rechazo del servidor', async () => {
    await render();

    type(element, 'input[formcontrolname=paymentDueDay]', '40');
    click(element, 'button[type=submit]');
    await settle();
    expect(textOf(element)).toContain('Debe ser un día entre 1 y 31');
    context.http.expectNone(BILLING_SETTINGS_URL);

    type(element, 'input[formcontrolname=paymentDueDay]', '10');
    click(element, 'button[type=submit]');
    context.http
      .expectOne(BILLING_SETTINGS_URL)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(textOf(element)).toContain(
      'Solo el administrador del prestador cambia esta configuración',
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('sube, cambia y quita el logo sin esperar a guardar', async () => {
    await render();
    const logoUrl = `${BILLING_SETTINGS_URL}/logo`;
    const picker = element.querySelector<HTMLInputElement>('input[type=file]')!;
    function choose(file: File | null): void {
      Object.defineProperty(picker, 'files', { value: file ? [file] : [], configurable: true });
      picker.dispatchEvent(new Event('change'));
    }
    expect(textOf(element)).toContain('Las facturas salen sin logo');

    choose(null);
    choose(new File(['%PDF'], 'logo.pdf', { type: 'application/pdf' }));
    await settle();
    expect(textOf(element)).toContain('El logo debe ser una imagen PNG o JPG');
    context.http.expectNone(logoUrl);

    const image = new File(['png'], 'logo.png', { type: 'image/png' });
    choose(image);
    const upload = context.http.expectOne(logoUrl);
    expect(upload.request.method).toBe('PUT');
    expect((upload.request.body as FormData).get('file')).toBe(image);
    upload.flush({ paymentDueDay: 15, lateFee: 2000, hasLogo: true });
    await settle();
    expect(textOf(element)).toContain('Las facturas salen con tu logo');
    expect(textOf(element)).toContain('Cambiar logo');

    const remove = [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      textOf(candidate).includes('Quitar logo'),
    );
    remove?.click();
    context.http
      .expectOne(logoUrl)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(textOf(element)).toContain('Solo el administrador del prestador');

    remove?.click();
    const removal = context.http.expectOne(logoUrl);
    expect(removal.request.method).toBe('DELETE');
    removal.flush({ paymentDueDay: 15, lateFee: 2000, hasLogo: false });
    await settle();
    expect(textOf(element)).toContain('Las facturas salen sin logo');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
