import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { access, authResponse } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { subscriber, SUBSCRIBER_ID } from '../../../../testing/subscriber-fixtures';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { Subscriber } from '../../subscribers/subscriber.models';
import { SUBSCRIBERS_URL } from '../../subscribers/subscribers-api';
import { ChargeSubscriberDialog } from '../charge-subscriber-dialog/charge-subscriber-dialog';
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
    // El activo con cuotas facturadas recibe suscriptores o se cancela; el cancelado sin facturar solo se elimina
    expect(element.querySelectorAll('article')[0].querySelectorAll('button')).toHaveLength(2);
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

  it('agrega un suscriptor al cobro desde el diálogo', async () => {
    await open([charge()]);

    dialogResult = undefined;
    button('Agregar suscriptor')?.click();
    context.http.expectNone(GLOBAL_CHARGES_URL);

    dialogResult = true;
    button('Agregar suscriptor')?.click();
    await settle();
    await load([charge({ subscribers: 121 })]);
    expect(document.body.textContent).toContain('Suscriptor agregado al cobro');
    expect(textOf(element)).toContain('121 suscriptores');
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

describe('ChargeSubscriberDialog', () => {
  const dialogRef = { close: vi.fn() };
  const addUrl = `${GLOBAL_CHARGES_URL}/${CHARGE_ID}/subscribers`;
  let context: PageTestContext;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  beforeEach(async () => {
    dialogRef.close.mockReset();
    context = setUpPage({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: charge() },
      ],
    });
    element = TestBed.createComponent(ChargeSubscriberDialog).nativeElement;
    await settle();
  });

  async function search(text: string, found: Subscriber[]): Promise<void> {
    type(element, 'input[type=search]', text);
    click(element, 'form.search button[type=submit]');
    await settle();
    context.http
      .expectOne((request) => request.url === SUBSCRIBERS_URL && request.params.get('q') === text)
      .flush({ items: found, page: 0, size: 5, totalItems: found.length, totalPages: 1 });
    await settle();
  }

  it('busca al suscriptor y le aplica el cobro', async () => {
    expect(textOf(element)).toContain('Agregar suscriptor a «Aporte tanque»');
    context.http.expectNone(SUBSCRIBERS_URL);

    await search('nadie', []);
    expect(textOf(element)).toContain('Ningún suscriptor coincide');

    await search('luz', [subscriber(), subscriber({ id: 'inactive', status: 'INACTIVE' })]);
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('.results button')];
    expect(buttons[1].disabled).toBe(true);
    expect(textOf(buttons[1])).toBe('Inactivo');

    buttons[0].click();
    const request = context.http.expectOne(addUrl);
    expect(request.request.body).toEqual({ subscriberId: SUBSCRIBER_ID });
    request.flush({});

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('explica cuando el suscriptor ya tiene el cobro o la búsqueda falla', async () => {
    await search('maría', [subscriber()]);

    click(element, '.results button');
    context.http.expectOne(addUrl).flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(textOf(element)).toContain('ya tiene este cobro');
    expect(dialogRef.close).not.toHaveBeenCalled();

    type(element, 'input[type=search]', 'otro');
    click(element, 'form.search button[type=submit]');
    await settle();
    context.http
      .expectOne((request) => request.url === SUBSCRIBERS_URL)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(textOf(element)).toContain('No pudimos buscar los suscriptores');
  });
});
