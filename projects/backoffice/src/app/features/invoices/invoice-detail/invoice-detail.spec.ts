import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { invoice, INVOICE_ID, PLAN_ID } from '../../../../testing/billing-fixtures';
import { access, authResponse } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { Invoice } from '../invoice.models';
import { INVOICES_URL } from '../invoices-api';
import { OtherChargesDialog } from '../other-charges-dialog/other-charges-dialog';
import { ReversePaymentDialog } from '../reverse-payment-dialog/reverse-payment-dialog';
import { InvoiceDetail } from './invoice-detail';

const INVOICE_URL = `${INVOICES_URL}/${INVOICE_ID}`;

interface Actions {
  editOtherCharges: (invoice: Invoice) => void;
}

describe('InvoiceDetail', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<InvoiceDetail>;
  let element: HTMLElement;
  let dialogResult: unknown;

  afterEach(() => context.http.verify());

  async function open(bill: Invoice | null, role: OrganizationRole = 'OPERATOR'): Promise<void> {
    dialogResult = true;
    context = setUpPage({
      session: authResponse({ organization: access({ role }) }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(InvoiceDetail);
    fixture.componentRef.setInput('id', INVOICE_ID);
    element = fixture.nativeElement;
    await settle();
    const request = context.http.expectOne(INVOICE_URL);
    if (bill) {
      request.flush(bill);
    } else {
      request.flush(null, { status: 404, statusText: 'Not Found' });
    }
    await settle();
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      textOf(candidate).includes(label),
    );
  }

  it('muestra el desglose completo de la factura', async () => {
    await open(
      invoice({
        adjustmentPercent: -50,
        adjustment: -4000,
        installment: {
          planId: PLAN_ID,
          description: 'Medidor nuevo',
          number: 2,
          count: 6,
          amount: 20000,
        },
        otherCharges: 5000,
        otherChargesDescription: 'Reconexión',
        previousDebt: 30000,
        lateFee: 2000,
        total: 78500,
        state: 'OVERDUE',
      }),
    );
    const text = textOf(element);

    expect(text).toContain('Factura n.º 12');
    expect(text).toContain('Acueducto · Octubre 2026');
    expect(text).toContain('000042 · María Gómez');
    expect(text).toContain('120 → 135 = 15 m³');
    expect(text).toContain('Subsidio (-50 %)');
    expect(text).toContain('Medidor nuevo (cuota 2 de 6)');
    expect(text).toContain('Otros cobros (Reconexión)');
    expect(text).toContain('Deuda anterior');
    expect(text).toContain('Recargo por no pago');
    expect(text).toContain('$78,500');
    expect(text).toContain('Vencida');
    expect(button('Pago en efectivo')).toBeDefined();
  });

  it('un servicio sin medidor no muestra lectura ni consumo', async () => {
    await open(
      invoice({
        serviceType: 'SANITATION',
        readingId: null,
        previousReading: 0,
        currentReading: 0,
        consumption: 0,
        consumptionCharge: 0,
        fixedCharge: 12000,
        total: 12000,
      }),
    );
    const text = textOf(element);

    expect(text).toContain('Aseo');
    expect(text).toContain('Cargo fijo');
    expect(text).toContain('$12,000');
    expect(text).not.toContain('Lectura');
    expect(text).not.toContain('Consumo');
  });

  it('registra el pago y deja la factura en solo consulta', async () => {
    await open(invoice({ adjustment: 3000, adjustmentPercent: 20 }));

    expect(textOf(element)).toContain('Contribución (20 %)');
    button('Pago por banco')?.click();
    const request = context.http.expectOne(`${INVOICE_URL}/pay`);
    expect(request.request.body).toEqual({ method: 'BANK' });
    request.flush(
      invoice({ state: 'PAID', paymentMethod: 'BANK', paidAt: '2026-10-12T15:00:00Z' }),
    );
    await settle();

    expect(textOf(element)).toContain('Pagada');
    expect(textOf(element)).toContain('Banco ·');
    expect(button('Pago en efectivo')).toBeUndefined();
    expect(button('Otros cobros')).toBeUndefined();
  });

  it('cobra en efectivo solo si se confirma', async () => {
    await open(invoice());

    dialogResult = false;
    button('Pago en efectivo')?.click();
    context.http.expectNone(`${INVOICE_URL}/pay`);

    dialogResult = true;
    button('Pago en efectivo')?.click();
    context.http
      .expectOne(`${INVOICE_URL}/pay`)
      .flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(document.body.textContent).toContain('Esta factura ya estaba pagada');
  });

  it('actualiza la factura al cambiar los otros cobros', async () => {
    await open(invoice());
    const actions = fixture.componentInstance as unknown as Actions;

    dialogResult = undefined;
    actions.editOtherCharges(invoice());
    dialogResult = invoice({ otherCharges: 5000, otherChargesDescription: null, total: 30500 });
    button('Otros cobros')?.click();
    await settle();

    expect(textOf(element)).toContain('$30,500');
    expect(document.body.textContent).toContain('Otros cobros actualizados');
  });

  it('el administrador reversa un pago y la factura vuelve a quedar pendiente', async () => {
    const paid = invoice({ state: 'PAID', paymentMethod: 'CASH', paidAt: '2026-10-12T15:00:00Z' });
    await open(paid, 'ORG_ADMIN');

    dialogResult = undefined;
    button('Reversar pago')?.click();
    await settle();
    expect(textOf(element)).toContain('Pagada');

    dialogResult = invoice();
    button('Reversar pago')?.click();
    await settle();

    expect(document.body.textContent).toContain('Pago de la factura n.º 12 reversado');
    expect(textOf(element)).toContain('Pendiente');
    expect(button('Reversar pago')).toBeUndefined();
    expect(button('Pago en efectivo')).toBeDefined();
  });

  it('solo el administrador ve la opción de reversar, y solo en facturas pagadas', async () => {
    await open(invoice({ state: 'PAID', paymentMethod: 'CASH' }), 'OPERATOR');
    expect(button('Reversar pago')).toBeUndefined();
    TestBed.resetTestingModule();

    await open(invoice(), 'ORG_ADMIN');
    expect(button('Reversar pago')).toBeUndefined();
  });

  it('descarga el PDF con el número de la factura, y avisa si falla', async () => {
    await open(invoice(), 'VIEWER');
    const createObjectURL = vi.fn(() => 'blob:factura');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    let fileName = '';
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      fileName = this.download;
    });

    button('Descargar PDF')?.click();
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    context.http.expectOne(`${INVOICE_URL}/pdf`).flush(pdf);

    expect(createObjectURL).toHaveBeenCalledWith(pdf);
    expect(fileName).toBe('factura-12.pdf');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:factura');

    button('Descargar PDF')?.click();
    context.http
      .expectOne(`${INVOICE_URL}/pdf`)
      .flush(new Blob(), { status: 500, statusText: 'Server Error' });
    await settle();
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(
      document.body.querySelector('simple-snack-bar, .mat-mdc-snack-bar-label'),
    ).not.toBeNull();

    vi.unstubAllGlobals();
    anchorClick.mockRestore();
  });

  it('una factura incluida en la siguiente no se cobra por separado', async () => {
    await open(invoice({ state: 'CARRIED' }));

    expect(textOf(element)).toContain('pasó como deuda anterior a la factura siguiente');
    expect(button('Pago en efectivo')).toBeUndefined();
  });

  it('el rol de consulta no ve acciones y una factura inexistente se informa', async () => {
    await open(invoice(), 'VIEWER');
    expect(button('Pago en efectivo')).toBeUndefined();
    TestBed.resetTestingModule();

    await open(null);
    expect(textOf(element)).toContain('No encontramos esta factura');
  });
});

describe('OtherChargesDialog', () => {
  const dialogRef = { close: vi.fn() };
  const url = `${INVOICE_URL}/other-charges`;
  let context: PageTestContext;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function render(): Promise<void> {
    dialogRef.close.mockReset();
    context = setUpPage({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: invoice() },
      ],
    });
    element = TestBed.createComponent(OtherChargesDialog).nativeElement;
    await settle();
  }

  it('guarda el valor y el concepto', async () => {
    await render();

    type(element, 'input[formcontrolname=amount]', '5000');
    type(element, 'input[formcontrolname=description]', ' Reconexión ');
    click(element, 'button[type=submit]');
    const request = context.http.expectOne(url);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ amount: 5000, description: 'Reconexión' });
    const updated = invoice({ otherCharges: 5000, otherChargesDescription: 'Reconexión' });
    request.flush(updated);

    expect(dialogRef.close).toHaveBeenCalledWith(updated);
  });

  it('no envía valores negativos y muestra el rechazo del servidor', async () => {
    await render();

    type(element, 'input[formcontrolname=amount]', '-1');
    click(element, 'button[type=submit]');
    await settle();
    expect(textOf(element)).toContain('Debe ser cero o más');
    context.http.expectNone(url);

    type(element, 'input[formcontrolname=amount]', '0');
    click(element, 'button[type=submit]');
    const request = context.http.expectOne(url);
    expect(request.request.body).toEqual({ amount: 0, description: null });
    request.flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();

    expect(textOf(element)).toContain('ya está pagada o está incluida en una posterior');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});

describe('ReversePaymentDialog', () => {
  const dialogRef = { close: vi.fn() };
  const url = `${INVOICE_URL}/reverse-payment`;
  const paid = invoice({ state: 'PAID', paymentMethod: 'CASH' });
  let context: PageTestContext;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function render(): Promise<void> {
    dialogRef.close.mockReset();
    context = setUpPage({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: paid },
      ],
    });
    element = TestBed.createComponent(ReversePaymentDialog).nativeElement;
    await settle();
  }

  it('exige el motivo y lo envía con el reverso', async () => {
    await render();
    expect(textOf(element)).toContain(
      'La factura n.º 12 de María Gómez volverá a quedar pendiente',
    );

    type(element, 'input[formcontrolname=reason]', '   ');
    click(element, 'button[type=submit]');
    await settle();
    expect(textOf(element)).toContain('Indica por qué se reversa el pago');
    context.http.expectNone(url);

    type(element, 'input[formcontrolname=reason]', ' Se cobró al predio equivocado ');
    click(element, 'button[type=submit]');
    const request = context.http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Se cobró al predio equivocado' });
    request.flush(invoice());

    expect(dialogRef.close).toHaveBeenCalledWith(invoice());
  });

  it('muestra el rechazo del servidor', async () => {
    await render();

    type(element, 'input[formcontrolname=reason]', 'Error de digitación');
    click(element, 'button[type=submit]');
    context.http
      .expectOne(url)
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();

    expect(textOf(element)).toContain('ya tiene una factura posterior');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
