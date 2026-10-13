import { TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { of } from 'rxjs';
import { access, authResponse } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { Page } from '../../organizations/organization.models';
import { isoDate } from '../../reports/report.models';
import { Balance, Movement, MOVEMENTS_URL, MovementType } from '../finance.models';
import { MovementDialog } from '../movement-dialog/movement-dialog';
import { MovementList } from './movement-list';

const BALANCE_URL = `${MOVEMENTS_URL}/balance`;
const MOVEMENT_ID = '99999999-9999-9999-9999-999999999999';
const TODAY = isoDate(new Date());
const FIRST_OF_MONTH = `${TODAY.slice(0, 8)}01`;

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: MOVEMENT_ID,
    type: 'EXPENSE',
    date: '2026-10-05',
    category: 'Mantenimiento',
    description: 'Reparación de tubería',
    amount: 150000,
    attachment: null,
    createdAt: '2026-10-05T15:00:00Z',
    ...overrides,
  };
}

function page(items: Movement[], totalItems = items.length): Page<Movement> {
  return { items, page: 0, size: 20, totalItems, totalPages: 1 };
}

const BALANCE: Balance = {
  invoiceCollections: 2000000,
  otherIncome: 500000,
  expenses: 800000,
  balance: 1700000,
};

interface Actions {
  changeRange: (from: string, to: string) => void;
  filterBy: (type: MovementType | 'ALL') => void;
  changePage: (event: PageEvent) => void;
}

describe('MovementList', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<MovementList>;
  let element: HTMLElement;
  let actions: Actions;
  let dialogResult: unknown;

  afterEach(() => {
    context.http.verify();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function open(role: OrganizationRole = 'OPERATOR'): Promise<void> {
    dialogResult = true;
    context = setUpPage({
      session: authResponse({ organization: access({ role }) }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(MovementList);
    element = fixture.nativeElement;
    actions = fixture.componentInstance as unknown as Actions;
    await settle();
  }

  /** La consulta pendiente de movimientos cuyos parámetros coinciden; `null` exige que no vaya. */
  function expectMovements(params: Record<string, string | null> = {}): TestRequest {
    return context.http.expectOne(
      (request) =>
        request.url === MOVEMENTS_URL &&
        Object.entries(params).every(([name, value]) => request.params.get(name) === value),
    );
  }

  async function load(items: Movement[], balance: Balance | null = BALANCE): Promise<void> {
    expectMovements().flush(page(items));
    const request = context.http.expectOne((candidate) => candidate.url === BALANCE_URL);
    if (balance) {
      request.flush(balance);
    } else {
      request.flush(null, { status: 400, statusText: 'Bad Request' });
    }
    await settle();
  }

  function captureDownloads(): string[] {
    const names: string[] = [];
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:file', revokeObjectURL: () => undefined });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    return names;
  }

  it('muestra el saldo del mes y los movimientos', async () => {
    await open();
    expectMovements({ from: FIRST_OF_MONTH, to: TODAY, type: null, page: '0' }).flush(
      page([
        movement({
          attachment: { fileName: 'recibo.pdf', contentType: 'application/pdf', size: 9 },
        }),
        movement({ id: 'income', type: 'INCOME', category: 'Aportes', description: 'Alcaldía' }),
      ]),
    );
    context.http.expectOne((request) => request.url === BALANCE_URL).flush(BALANCE);
    await settle();
    const text = textOf(element);

    expect(text).toContain('Recaudo de facturas$2,000,000');
    expect(text).toContain('Otros ingresos$500,000');
    expect(text).toContain('Gastos$800,000');
    expect(text).toContain('Saldo del periodo$1,700,000');
    expect(text).toContain('Ingresos menos gastos');
    expect(text).toContain('Mantenimiento');
    expect(text).toContain('Reparación de tubería');
    expect(text).toContain('Aportes');
    // Solo el movimiento con soporte ofrece descargarlo
    expect(element.querySelectorAll('button[aria-label^="Descargar soporte"]')).toHaveLength(1);
    expect(element.querySelectorAll('button[aria-label^="Corregir"]')).toHaveLength(2);
  });

  it('filtra por fechas y tipo volviendo a la primera página', async () => {
    await open();
    expectMovements().flush(page([movement()], 45));
    context.http
      .expectOne((request) => request.url === BALANCE_URL)
      .flush({ ...BALANCE, balance: -300000 });
    await settle();
    expect(textOf(element)).toContain('Se gastó más de lo que entró');

    actions.changePage({ pageIndex: 1, pageSize: 20, length: 45 });
    await settle();
    expectMovements({ page: '1' }).flush(page([movement()], 45));

    actions.filterBy('EXPENSE');
    await settle();
    expectMovements({ type: 'EXPENSE', page: '0' }).flush(page([]));
    await settle();
    expect(textOf(element)).toContain('No hay movimientos en estas fechas');

    actions.changeRange('2026-09-01', '2026-09-30');
    actions.filterBy('ALL');
    await settle();
    expectMovements({ from: '2026-09-01', to: '2026-09-30', type: null }).flush(page([]));
    context.http
      .expectOne(
        (request) => request.url === BALANCE_URL && request.params.get('from') === '2026-09-01',
      )
      .flush(BALANCE);

    actions.changeRange('2026-09-30', '2026-09-01');
    await settle();
    expect(textOf(element)).toContain('«Desde» no puede ser posterior a «Hasta»');
  });

  it('registra y corrige movimientos desde el diálogo', async () => {
    await open();
    await load([movement()]);

    dialogResult = undefined;
    click(element, 'button[aria-label^="Corregir"]');
    await settle();

    dialogResult = movement({ amount: 175000 });
    click(element, 'button[aria-label^="Corregir"]');
    await settle();
    await load([movement({ amount: 175000 })]);
    expect(document.body.textContent).toContain('Movimiento actualizado');

    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => textOf(candidate).includes('Registrar'))
      ?.click();
    await settle();
    await load([movement()]);
    expect(document.body.textContent).toContain('Movimiento registrado');
  });

  it('elimina solo si se confirma y avisa si el servidor lo rechaza', async () => {
    await open();
    await load([movement()]);

    dialogResult = false;
    click(element, 'button[aria-label^="Eliminar"]');
    context.http.expectNone(`${MOVEMENTS_URL}/${MOVEMENT_ID}`);

    dialogResult = true;
    click(element, 'button[aria-label^="Eliminar"]');
    context.http
      .expectOne(`${MOVEMENTS_URL}/${MOVEMENT_ID}`)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(document.body.textContent).toContain('Tu rol solo permite consultar');

    click(element, 'button[aria-label^="Eliminar"]');
    const request = context.http.expectOne(`${MOVEMENTS_URL}/${MOVEMENT_ID}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await settle();
    await load([]);
    expect(document.body.textContent).toContain('Movimiento eliminado');
  });

  it('descarga el soporte y la exportación para Excel', async () => {
    await open('VIEWER');
    await load([
      movement({ attachment: { fileName: 'recibo.pdf', contentType: 'application/pdf', size: 9 } }),
    ]);
    const downloads = captureDownloads();
    // El rol de consulta no registra, corrige ni elimina
    expect(element.querySelector('button[aria-label^="Corregir"]')).toBeNull();

    click(element, 'button[aria-label^="Descargar soporte"]');
    context.http.expectOne(`${MOVEMENTS_URL}/${MOVEMENT_ID}/attachment`).flush(new Blob(['pdf']));
    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => textOf(candidate).includes('Para Excel'))
      ?.click();
    context.http
      .expectOne((request) => request.url === `${MOVEMENTS_URL}/export`)
      .flush(new Blob(['csv']));

    expect(downloads).toEqual(['recibo.pdf', `ingresos-y-gastos-${FIRST_OF_MONTH}-a-${TODAY}.csv`]);

    click(element, 'button[aria-label^="Descargar soporte"]');
    context.http
      .expectOne(`${MOVEMENTS_URL}/${MOVEMENT_ID}/attachment`)
      .flush(new Blob(), { status: 404, statusText: 'Not Found' });
    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => textOf(candidate).includes('Para Excel'))
      ?.click();
    context.http
      .expectOne((request) => request.url === `${MOVEMENTS_URL}/export`)
      .flush(new Blob(), { status: 500, statusText: 'Server Error' });
    await settle();
    expect(downloads).toHaveLength(2);
  });

  it('informa si los movimientos o el saldo no cargan', async () => {
    await open();
    await load([movement()], null);

    expect(textOf(element)).toContain('No pudimos cargar los ingresos y gastos');
  });
});

describe('MovementDialog', () => {
  const dialogRef = { close: vi.fn() };
  let context: PageTestContext;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function render(current: Movement | null): Promise<void> {
    dialogRef.close.mockReset();
    context = setUpPage({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: current },
      ],
    });
    element = TestBed.createComponent(MovementDialog).nativeElement;
    await settle();
  }

  function choose(file: File): void {
    const input = element.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  it('registra un gasto y sube su soporte', async () => {
    await render(null);
    expect(textOf(element)).toContain('Registrar ingreso o gasto');

    click(element, 'button[type=submit]');
    await settle();
    expect(textOf(element)).toContain('Indica la categoría');
    expect(textOf(element)).toContain('Debe ser mayor que cero');
    context.http.expectNone(MOVEMENTS_URL);

    type(element, 'input[formcontrolname=date]', '2026-10-05');
    type(element, 'input[formcontrolname=amount]', '150000');
    type(element, 'input[formcontrolname=category]', ' Mantenimiento ');
    type(element, 'input[formcontrolname=description]', ' Reparación de tubería ');
    const receipt = new File(['%PDF'], 'recibo.pdf', { type: 'application/pdf' });
    choose(receipt);
    await settle();
    expect(textOf(element)).toContain('recibo.pdf');

    click(element, 'button[type=submit]');
    const create = context.http.expectOne(MOVEMENTS_URL);
    expect(create.request.body).toEqual({
      type: 'EXPENSE',
      date: '2026-10-05',
      category: 'Mantenimiento',
      description: 'Reparación de tubería',
      amount: 150000,
    });
    create.flush(movement());
    const upload = context.http.expectOne(`${MOVEMENTS_URL}/${MOVEMENT_ID}/attachment`);
    expect(upload.request.method).toBe('PUT');
    expect((upload.request.body as FormData).get('file')).toBe(receipt);
    const saved = movement({
      attachment: { fileName: 'recibo.pdf', contentType: 'application/pdf', size: 4 },
    });
    upload.flush(saved);

    expect(dialogRef.close).toHaveBeenCalledWith(saved);
  });

  it('corrige un movimiento sin tocar su soporte', async () => {
    await render(
      movement({ attachment: { fileName: 'viejo.pdf', contentType: 'application/pdf', size: 4 } }),
    );
    expect(textOf(element)).toContain('Corregir movimiento');
    expect(textOf(element)).toContain('Actual: viejo.pdf');
    expect(textOf(element)).toContain('Cambiar soporte');

    type(element, 'input[formcontrolname=amount]', '175000');
    click(element, 'button[type=submit]');
    const request = context.http.expectOne(`${MOVEMENTS_URL}/${MOVEMENT_ID}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.amount).toBe(175000);
    request.flush(movement({ amount: 175000 }));

    expect(dialogRef.close).toHaveBeenCalledWith(movement({ amount: 175000 }));
  });

  it('rechaza soportes de otro tipo o muy pesados y muestra el error del servidor', async () => {
    await render(movement());

    choose(new File(['MZ'], 'virus.exe', { type: 'application/x-msdownload' }));
    await settle();
    expect(textOf(element)).toContain('debe ser un PDF o una imagen JPG o PNG');

    const heavy = new File(['%PDF'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(heavy, 'size', { value: 5 * 1024 * 1024 + 1 });
    choose(heavy);
    await settle();
    expect(textOf(element)).toContain('no puede pesar más de 5 MB');

    click(element, 'button[type=submit]');
    context.http
      .expectOne(`${MOVEMENTS_URL}/${MOVEMENT_ID}`)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(textOf(element)).toContain('Tu rol solo permite consultar');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
