import { ComponentFixture, TestBed } from '@angular/core/testing';
import { access, authResponse, user } from '../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../testing/setup';
import { AuthResponse } from '../../core/auth/auth.models';
import { BillingSummary, REPORTS_URL } from '../reports/report.models';
import { Home } from './home';

const SUMMARY_URL = `${REPORTS_URL}/summary`;

function summary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    billed: { year: 2026, month: 10, invoices: 120, amount: 3200000 },
    collected: { payments: 85, amount: 2100000 },
    outstanding: { invoices: 40, subscribers: 35, amount: 1500000, overdueAmount: 600000 },
    ...overrides,
  };
}

describe('Home', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<Home>;

  afterEach(() => context.http.verify());

  async function open(session?: AuthResponse): Promise<void> {
    context = setUpPage({ session });
    fixture = TestBed.createComponent(Home);
    await settle();
  }

  async function render(figures: BillingSummary | null, session?: AuthResponse): Promise<string> {
    await open(session);
    const request = context.http.expectOne(SUMMARY_URL);
    if (figures) {
      request.flush(figures);
    } else {
      request.flush(null, { status: 500, statusText: 'Server Error' });
    }
    await settle();
    return textOf(fixture.nativeElement);
  }

  it('saluda y muestra el prestador, el rol y las cifras', async () => {
    const text = await render(
      summary(),
      authResponse({ organization: access({ inherited: true, role: 'ORG_ADMIN' }) }),
    );

    expect(text).toContain('Hola, Ana');
    expect(text).toContain('Tu rol: Administrador');
    expect(text).toContain('acceso por vinculación');
    expect(text).toContain('Último periodo facturado$3,200,000');
    expect(text).toContain('Octubre 2026 · 120 facturas');
    expect(text).toContain('Recaudado este mes$2,100,000');
    expect(text).toContain('85 pagos');
    expect(text).toContain('Por cobrar$1,500,000');
    expect(text).toContain('35 suscriptores · vencido $600,000');
    expect(text).toContain('Recaudo e informes');
    expect(text).not.toContain('Administración de plataforma');
  });

  it('usa el singular y explica cuando aún no hay facturas ni deuda', async () => {
    const single = await render(
      summary({
        billed: { year: 2026, month: 10, invoices: 1, amount: 25500 },
        collected: { payments: 1, amount: 25500 },
        outstanding: { invoices: 1, subscribers: 1, amount: 18000, overdueAmount: 0 },
      }),
    );
    expect(single).toContain('1 factura');
    expect(single).toContain('1 pago');
    expect(single).toContain('1 suscriptor · vencido $0');
    TestBed.resetTestingModule();

    const empty = await render(
      summary({
        billed: null,
        collected: { payments: 0, amount: 0 },
        outstanding: { invoices: 0, subscribers: 0, amount: 0, overdueAmount: 0 },
      }),
    );
    expect(empty).toContain('Aún no hay facturas');
    expect(empty).toContain('Nadie debe');
  });

  it('advierte cuando el prestador está suspendido y deja reintentar si las cifras fallan', async () => {
    const text = await render(null, authResponse({ organization: access({ active: false }) }));

    expect(text).toContain('Este prestador está suspendido');
    expect(text).toContain('No pudimos cargar las cifras');
  });

  it('ofrece la administración al administrador de plataforma, sin cifras si no eligió prestador', async () => {
    await open(authResponse({ user: user({ platformAdmin: true }), organization: null }));

    context.http.expectNone(SUMMARY_URL);
    expect(textOf(fixture.nativeElement)).toContain('Administración de plataforma');
  });
});
