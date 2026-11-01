import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { Settlement, SETTLEMENTS_URL } from '../settlement.models';
import { SettlementList } from './settlement-list';

const NOW = new Date();
const LIST_URL = `${SETTLEMENTS_URL}?year=${NOW.getFullYear()}&month=${NOW.getMonth() + 1}`;

function settlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: 'liquidacion',
    organizationId: 'prestador',
    organizationName: 'Acueducto El Hato',
    year: NOW.getFullYear(),
    month: NOW.getMonth() + 1,
    status: 'DRAFT',
    activeSubscribers: 300,
    jointSanitation: false,
    suiCharacterization: 'RURAL',
    electronicInvoices: 0,
    brebPayments: 10,
    dispersions: 0,
    planCharge: 120000,
    extraSubscribersCharge: 0,
    electronicInvoicesCharge: 0,
    brebPaymentsCharge: 13000,
    dispersionsCharge: 0,
    jointSanitationCharge: 0,
    suiReportsCharge: 0,
    total: 133000,
    issuedAt: null,
    ...overrides,
  };
}

describe('SettlementList', () => {
  let context: PageTestContext;
  let confirmed: boolean;

  afterEach(() => context.http.verify());

  async function open(settlements: Settlement[]) {
    confirmed = true;
    context = setUpPage({
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirmed) }) } },
      ],
    });
    const fixture = TestBed.createComponent(SettlementList);
    await settle();
    context.http.expectOne(LIST_URL).flush(settlements);
    await settle();
    return fixture;
  }

  it('muestra lo del plan, los adicionales y el total del mes', async () => {
    const fixture = await open([settlement()]);
    const text = textOf(fixture.nativeElement);

    expect(text).toContain('Acueducto El Hato');
    expect(text).toContain('120,000');
    expect(text).toContain('13,000');
    expect(text).toContain('Total del mes');
    expect(text).toContain('Borrador');
  });

  it('una liquidación emitida ya no ofrece cambios', async () => {
    const fixture = await open([settlement({ status: 'ISSUED' })]);
    const text = textOf(fixture.nativeElement);

    expect(text).toContain('Emitida');
    expect(text).not.toContain('Consumos');
  });

  it('genera las liquidaciones del mes elegido', async () => {
    const fixture = await open([]);

    fixture.componentInstance['generate']();
    const request = context.http.expectOne(SETTLEMENTS_URL);
    expect(request.request.body).toEqual({ year: NOW.getFullYear(), month: NOW.getMonth() + 1 });
    request.flush([settlement()]);
    await settle();

    expect(textOf(fixture.nativeElement)).toContain('Acueducto El Hato');
  });

  it('emite solo si se confirma', async () => {
    const fixture = await open([settlement()]);
    const page = fixture.componentInstance;

    confirmed = false;
    page['issue'](settlement());
    context.http.expectNone(`${SETTLEMENTS_URL}/liquidacion/issue`);

    confirmed = true;
    page['issue'](settlement());
    context.http
      .expectOne(`${SETTLEMENTS_URL}/liquidacion/issue`)
      .flush(settlement({ status: 'ISSUED' }));
    await settle();
    context.http.expectOne(LIST_URL).flush([settlement({ status: 'ISSUED' })]);
    await settle();
  });

  it('con un prestador seleccionado explica por qué no carga', async () => {
    confirmed = true;
    context = setUpPage();
    const fixture = TestBed.createComponent(SettlementList);
    await settle();
    context.http.expectOne(LIST_URL).flush(null, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(textOf(fixture.nativeElement)).toContain('sin prestador seleccionado');
  });
});
