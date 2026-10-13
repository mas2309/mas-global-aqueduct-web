import { TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageEvent } from '@angular/material/paginator';
import { plan } from '../../../../testing/billing-fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { SUBSCRIBER_ID } from '../../../../testing/subscriber-fixtures';
import { PlanOverview as Overview, PlanStatus, PlanSummary } from '../invoice.models';
import { PLANS_URL } from '../invoices-api';
import { PlanOverview } from './plan-overview';

const OVERVIEW_URL = `${PLANS_URL}/overview`;

function summary(overrides: Partial<PlanSummary> = {}): PlanSummary {
  return { plan: plan(), subscriberCode: 42, subscriberName: 'María Gómez', ...overrides };
}

function overview(items: PlanSummary[], totalItems = items.length): Overview {
  return {
    activePlans: 3,
    pendingAmount: 250000,
    plans: { items, page: 0, size: 20, totalItems, totalPages: 1 },
  };
}

interface Actions {
  filterBy: (status: PlanStatus | 'ALL') => void;
  changePage: (event: PageEvent) => void;
}

describe('PlanOverview', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<PlanOverview>;
  let element: HTMLElement;
  let actions: Actions;

  afterEach(() => context.http.verify());

  async function open(): Promise<void> {
    context = setUpPage();
    fixture = TestBed.createComponent(PlanOverview);
    element = fixture.nativeElement;
    actions = fixture.componentInstance as unknown as Actions;
    await settle();
  }

  /** La consulta pendiente cuyos parámetros coinciden; `null` exige que el parámetro no vaya. */
  function expectOverview(params: Record<string, string | null> = {}): TestRequest {
    return context.http.expectOne(
      (request) =>
        request.url === OVERVIEW_URL &&
        Object.entries(params).every(([name, value]) => request.params.get(name) === value),
    );
  }

  it('muestra el resumen y el avance de las financiaciones activas', async () => {
    await open();
    expectOverview({ status: 'ACTIVE', page: '0' }).flush(overview([summary()]));
    await settle();
    const text = textOf(element);

    expect(text).toContain('Financiaciones activas');
    expect(text).toContain('3');
    expect(text).toContain('$250,000');
    expect(text).toContain('000042 · María Gómez');
    expect(text).toContain('Medidor nuevo');
    expect(text).toContain('$120,000');
    expect(text).toContain('6 cuotas de $20,000');
    expect(text).toContain('2 de 6 cobradas');
    expect(text).toContain('$80,000');
    expect(text).toContain('Activa');
    expect(element.querySelector(`a[href="/suscriptores/${SUBSCRIBER_ID}"]`)).not.toBeNull();
    expect(element.querySelector('td mat-progress-bar')?.getAttribute('aria-valuenow')).toBe('33');
  });

  it('filtra por estado volviendo a la primera página', async () => {
    await open();
    expectOverview().flush(overview([summary()], 45));
    await settle();

    actions.changePage({ pageIndex: 1, pageSize: 20, length: 45 });
    await settle();
    expectOverview({ status: 'ACTIVE', page: '1' }).flush(overview([summary()], 45));

    actions.filterBy('COMPLETED');
    await settle();
    expectOverview({ status: 'COMPLETED', page: '0' }).flush(
      overview([summary({ plan: plan({ billed: 6, status: 'COMPLETED' }) })]),
    );
    await settle();
    expect(textOf(element)).toContain('Terminada');
    expect(textOf(element)).toContain('—');

    actions.filterBy('ALL');
    await settle();
    expectOverview({ status: null }).flush(overview([]));
    await settle();
    expect(textOf(element)).toContain('No hay financiaciones con este filtro');
  });

  it('busca por suscriptor y limpia la búsqueda', async () => {
    await open();
    expectOverview({ q: null }).flush(overview([summary()], 45));
    await settle();
    actions.changePage({ pageIndex: 1, pageSize: 20, length: 45 });
    await settle();
    expectOverview({ page: '1' }).flush(overview([summary()], 45));

    type(element, 'input[type=search]', '  gómez ');
    click(element, 'form.search button[type=submit]');
    await settle();
    expectOverview({ q: 'gómez', page: '0' }).flush(overview([summary()]));
    await settle();

    click(element, 'button[aria-label="Limpiar búsqueda"]');
    await settle();
    expectOverview({ q: null }).flush(overview([summary()]));
  });

  it('informa si las financiaciones no cargan', async () => {
    await open();
    expectOverview().flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(textOf(element)).toContain('No pudimos cargar las financiaciones');
  });
});
