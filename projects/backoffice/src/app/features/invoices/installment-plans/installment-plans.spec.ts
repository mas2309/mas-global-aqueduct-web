import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { plan, PLAN_ID } from '../../../../testing/billing-fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { SUBSCRIBER_ID } from '../../../../testing/subscriber-fixtures';
import { InstallmentPlan } from '../invoice.models';
import { PLANS_URL } from '../invoices-api';
import { PlanDialog } from '../plan-dialog/plan-dialog';
import { InstallmentPlans } from './installment-plans';

const LIST_URL = `${PLANS_URL}?subscriberId=${SUBSCRIBER_ID}`;

describe('InstallmentPlans', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<InstallmentPlans>;
  let element: HTMLElement;
  let dialogResult: unknown;

  afterEach(() => context.http.verify());

  async function open(plans: InstallmentPlan[] | null, editable = true): Promise<void> {
    dialogResult = true;
    context = setUpPage({
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(InstallmentPlans);
    fixture.componentRef.setInput('subscriberId', SUBSCRIBER_ID);
    fixture.componentRef.setInput('editable', editable);
    element = fixture.nativeElement;
    await settle();
    await load(plans);
  }

  async function load(plans: InstallmentPlan[] | null): Promise<void> {
    const request = context.http.expectOne(LIST_URL);
    if (plans) {
      request.flush(plans);
    } else {
      request.flush(null, { status: 500, statusText: 'Server Error' });
    }
    await settle();
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      textOf(candidate).includes(label),
    );
  }

  it('muestra el avance de cada financiación', async () => {
    await open([
      plan(),
      plan({ id: 'done', description: 'Matrícula', billed: 6, status: 'COMPLETED' }),
    ]);
    const text = textOf(element);

    expect(text).toContain('Medidor nuevo');
    expect(text).toContain('$120,000 en 6 cuotas de $20,000');
    expect(text).toContain('2 de 6 cobradas');
    expect(text).toContain('Faltan $80,000');
    expect(text).toContain('Terminada');
    expect(element.querySelector(`a[href="/facturas?suscriptor=${SUBSCRIBER_ID}"]`)).not.toBeNull();
    // Solo la activa tiene acciones: pago anticipado y cancelar
    expect(element.querySelectorAll('.plan button')).toHaveLength(2);
  });

  it('crea una financiación desde el diálogo', async () => {
    await open([]);
    expect(textOf(element)).toContain('Sin financiaciones');

    dialogResult = undefined;
    button('Nueva financiación')?.click();
    context.http.expectNone(LIST_URL);

    dialogResult = plan();
    button('Nueva financiación')?.click();
    await settle();
    await load([plan()]);

    expect(document.body.textContent).toContain('Financiación creada');
    expect(textOf(element)).toContain('Medidor nuevo');
  });

  it('cancela una financiación activa', async () => {
    await open([plan()]);

    dialogResult = false;
    button('Cancelar')?.click();
    context.http.expectNone(`${PLANS_URL}/${PLAN_ID}/cancel`);

    dialogResult = true;
    button('Cancelar')?.click();
    context.http.expectOne(`${PLANS_URL}/${PLAN_ID}/cancel`).flush(plan({ status: 'CANCELLED' }));
    await settle();
    await load([plan({ status: 'CANCELLED' })]);
    expect(document.body.textContent).toContain('Financiación cancelada');
    expect(textOf(element)).toContain('Cancelada');
  });

  it('registra el pago anticipado y lo deshace', async () => {
    await open([plan({ globalChargeId: 'charge' })]);
    expect(textOf(element)).toContain('Cobro global');

    dialogResult = false;
    button('Pago anticipado')?.click();
    context.http.expectNone(`${PLANS_URL}/${PLAN_ID}/prepay`);

    dialogResult = true;
    button('Pago anticipado')?.click();
    context.http
      .expectOne(`${PLANS_URL}/${PLAN_ID}/prepay`)
      .flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(document.body.textContent).toContain('Esta financiación ya no está activa');

    button('Pago anticipado')?.click();
    context.http.expectOne(`${PLANS_URL}/${PLAN_ID}/prepay`).flush(plan({ status: 'PREPAID' }));
    await settle();
    await load([plan({ status: 'PREPAID' })]);
    expect(document.body.textContent).toContain('Pago anticipado registrado');
    expect(textOf(element)).toContain('Pagada por anticipado');
    expect(button('Cancelar')).toBeUndefined();

    button('Deshacer pago anticipado')?.click();
    context.http
      .expectOne(`${PLANS_URL}/${PLAN_ID}/revert-prepayment`)
      .flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(document.body.textContent).toContain('no tiene un pago anticipado');

    button('Deshacer pago anticipado')?.click();
    context.http.expectOne(`${PLANS_URL}/${PLAN_ID}/revert-prepayment`).flush(plan());
    await settle();
    await load([plan()]);
    expect(document.body.textContent).toContain('Pago anticipado deshecho');
  });

  it('avisa si la cancelación es rechazada', async () => {
    await open([plan()]);

    button('Cancelar')?.click();
    context.http
      .expectOne(`${PLANS_URL}/${PLAN_ID}/cancel`)
      .flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(document.body.textContent).toContain('Esta financiación ya no está activa');
  });

  it('sin permiso solo consulta, e informa si no cargan', async () => {
    await open([plan()], false);
    expect(button('Nueva financiación')).toBeUndefined();
    expect(button('Cancelar')).toBeUndefined();
    TestBed.resetTestingModule();

    await open(null);
    expect(textOf(element)).toContain('No pudimos cargar las financiaciones');
  });
});

describe('PlanDialog', () => {
  const dialogRef = { close: vi.fn() };
  let context: PageTestContext;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function render(): Promise<void> {
    dialogRef.close.mockReset();
    context = setUpPage({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: SUBSCRIBER_ID },
      ],
    });
    element = TestBed.createComponent(PlanDialog).nativeElement;
    await settle();
  }

  it('crea la financiación y muestra el valor aproximado de la cuota', async () => {
    await render();

    type(element, 'input[formcontrolname=description]', ' Medidor nuevo ');
    type(element, 'input[formcontrolname=totalAmount]', '120000');
    await settle();
    expect(textOf(element)).toContain('Cada factura cobrará cerca de $20,000');

    click(element, 'button[type=submit]');
    const request = context.http.expectOne(PLANS_URL);
    expect(request.request.body).toEqual({
      subscriberId: SUBSCRIBER_ID,
      description: 'Medidor nuevo',
      totalAmount: 120000,
      installments: 6,
    });
    request.flush(plan());

    expect(dialogRef.close).toHaveBeenCalledWith(plan());
  });

  it('exige los datos y muestra el rechazo del servidor', async () => {
    await render();

    click(element, 'button[type=submit]');
    await settle();
    expect(textOf(element)).toContain('Indica qué se financia');
    expect(textOf(element)).toContain('Debe ser mayor que cero');
    context.http.expectNone(PLANS_URL);

    type(element, 'input[formcontrolname=description]', 'Matrícula');
    type(element, 'input[formcontrolname=totalAmount]', '50000');
    type(element, 'input[formcontrolname=installments]', '2');
    click(element, 'button[type=submit]');
    context.http
      .expectOne(PLANS_URL)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(textOf(element)).toContain('Tu rol solo permite consultar');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
