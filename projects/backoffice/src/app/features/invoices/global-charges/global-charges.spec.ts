import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { access, authResponse } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { GlobalChargeDialog } from '../global-charge-dialog/global-charge-dialog';
import { GlobalCharge } from '../invoice.models';
import { GLOBAL_CHARGES_URL } from '../invoices-api';
import { GlobalCharges } from './global-charges';

const CHARGE_ID = '77777777-7777-7777-7777-777777777777';

function charge(overrides: Partial<GlobalCharge> = {}): GlobalCharge {
  return {
    id: CHARGE_ID,
    description: 'Aporte tanque',
    amount: 60000,
    installments: 3,
    active: true,
    subscribers: 120,
    billedInstallments: 90,
    totalAmount: 7200000,
    pendingAmount: 5400000,
    createdAt: '2026-10-01T15:00:00Z',
    ...overrides,
  };
}

describe('GlobalCharges', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<GlobalCharges>;
  let element: HTMLElement;
  let dialogResult: unknown;

  afterEach(() => context.http.verify());

  async function open(
    charges: GlobalCharge[] | null,
    role: OrganizationRole = 'ORG_ADMIN',
  ): Promise<void> {
    dialogResult = true;
    context = setUpPage({
      session: authResponse({ organization: access({ role }) }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(GlobalCharges);
    element = fixture.nativeElement;
    await settle();
    await load(charges);
  }

  async function load(charges: GlobalCharge[] | null): Promise<void> {
    const request = context.http.expectOne(GLOBAL_CHARGES_URL);
    if (charges) {
      request.flush(charges);
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

  it('muestra cada cobro con su avance', async () => {
    await open([
      charge(),
      charge({
        id: 'cancelled',
        description: 'Reposición',
        installments: 1,
        active: false,
        subscribers: 0,
        billedInstallments: 0,
      }),
    ]);
    const text = textOf(element);

    expect(text).toContain('Aporte tanque');
    expect(text).toContain('$60,000 por suscriptor en 3 cuotas');
    expect(text).toContain(
      '120 suscriptores · 90 cuotas facturadas · total $7,200,000 · falta $5,400,000',
    );
    expect(text).toContain('Activo');
    expect(text).toContain('en 1 cuota');
    expect(text).toContain('Cancelado');
    // 90 de 360 cuotas esperadas
    expect(element.querySelector('article mat-progress-bar')?.getAttribute('aria-valuenow')).toBe(
      '25',
    );
    // El activo con cuotas facturadas solo se cancela; el cancelado sin facturar solo se elimina
    expect(element.querySelectorAll('article')[0].querySelectorAll('button')).toHaveLength(1);
    expect(element.querySelectorAll('article')[1].querySelectorAll('button')).toHaveLength(1);
  });

  it('crea un cobro desde el diálogo', async () => {
    await open([]);
    expect(textOf(element)).toContain('Aún no hay cobros globales');

    dialogResult = undefined;
    button('Nuevo cobro global')?.click();
    context.http.expectNone(GLOBAL_CHARGES_URL);

    dialogResult = charge();
    button('Nuevo cobro global')?.click();
    await settle();
    await load([charge()]);
    expect(document.body.textContent).toContain('Cobro creado para 120 suscriptores');
  });

  it('cancela y elimina solo si se confirma', async () => {
    await open([charge({ billedInstallments: 0 })]);

    dialogResult = false;
    button('Cancelar')?.click();
    context.http.expectNone(`${GLOBAL_CHARGES_URL}/${CHARGE_ID}/cancel`);

    dialogResult = true;
    button('Cancelar')?.click();
    context.http
      .expectOne(`${GLOBAL_CHARGES_URL}/${CHARGE_ID}/cancel`)
      .flush(charge({ active: false }));
    await settle();
    await load([charge({ active: false, billedInstallments: 0 })]);
    expect(document.body.textContent).toContain('Cobro global cancelado');

    button('Eliminar')?.click();
    context.http
      .expectOne(`${GLOBAL_CHARGES_URL}/${CHARGE_ID}`)
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();
    expect(document.body.textContent).toContain('ya tiene cuotas facturadas');

    button('Eliminar')?.click();
    const request = context.http.expectOne(`${GLOBAL_CHARGES_URL}/${CHARGE_ID}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await settle();
    await load([]);
    expect(document.body.textContent).toContain('Cobro global eliminado');
  });

  it('quien no administra solo consulta, e informa si no cargan', async () => {
    await open([charge()], 'OPERATOR');
    expect(button('Nuevo cobro global')).toBeUndefined();
    expect(button('Cancelar')).toBeUndefined();
    TestBed.resetTestingModule();

    await open(null);
    expect(textOf(element)).toContain('No pudimos cargar los cobros globales');
  });
});

describe('GlobalChargeDialog', () => {
  const dialogRef = { close: vi.fn() };
  let context: PageTestContext;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function render(): Promise<void> {
    dialogRef.close.mockReset();
    context = setUpPage({ providers: [{ provide: MatDialogRef, useValue: dialogRef }] });
    element = TestBed.createComponent(GlobalChargeDialog).nativeElement;
    await settle();
  }

  it('crea el cobro y muestra el valor aproximado de la cuota', async () => {
    await render();

    click(element, 'button[type=submit]');
    await settle();
    expect(textOf(element)).toContain('Indica qué se cobra');
    expect(textOf(element)).toContain('Debe ser mayor que cero');
    context.http.expectNone(GLOBAL_CHARGES_URL);

    type(element, 'input[formcontrolname=description]', ' Aporte tanque ');
    type(element, 'input[formcontrolname=amount]', '60000');
    type(element, 'input[formcontrolname=installments]', '3');
    await settle();
    expect(textOf(element)).toContain('Cada factura cobrará cerca de $20,000');

    click(element, 'button[type=submit]');
    const request = context.http.expectOne(GLOBAL_CHARGES_URL);
    expect(request.request.body).toEqual({
      description: 'Aporte tanque',
      amount: 60000,
      installments: 3,
    });
    request.flush(charge());

    expect(dialogRef.close).toHaveBeenCalledWith(charge());
  });

  it('muestra el rechazo del servidor', async () => {
    await render();

    type(element, 'input[formcontrolname=description]', 'Aporte');
    type(element, 'input[formcontrolname=amount]', '1000');
    click(element, 'button[type=submit]');
    context.http
      .expectOne(GLOBAL_CHARGES_URL)
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();

    expect(textOf(element)).toContain('No hay suscriptores activos a quién cobrarle');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
