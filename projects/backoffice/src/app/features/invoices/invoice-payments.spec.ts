import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { invoice, INVOICE_ID } from '../../../testing/billing-fixtures';
import { PageTestContext, setUpPage } from '../../../testing/setup';
import { ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { InvoicePayments } from './invoice-payments';
import { INVOICES_URL } from './invoices-api';

const DOCUMENT_URL = `${INVOICES_URL}/${INVOICE_ID}/document`;

describe('InvoicePayments', () => {
  let context: PageTestContext;
  let payments: InvoicePayments;
  let shown: ConfirmDialogData | undefined;
  let confirmed = false;

  beforeEach(() => {
    shown = undefined;
    confirmed = false;
    context = setUpPage({
      providers: [
        {
          provide: MatDialog,
          useValue: {
            open: (_component: unknown, config: { data: ConfirmDialogData }) => {
              shown = config.data;
              return { afterClosed: () => of(confirmed) };
            },
          },
        },
      ],
    });
    payments = TestBed.inject(InvoicePayments);
  });

  afterEach(() => context.http.verify());

  /** Confirma el cobro y hace que el servidor lo rechace con ese detalle. */
  function rejectPayment(detail: string): void {
    confirmed = true;
    payments.pay(invoice(), 'CASH').subscribe({ error: () => undefined });
    context.http.expectOne(DOCUMENT_URL).flush([invoice()]);
    context.http
      .expectOne(`${INVOICES_URL}/${INVOICE_ID}/pay`)
      .flush({ detail }, { status: 422, statusText: 'Unprocessable Content' });
  }

  it('dice que la lectura está en revisión si por eso no se puede cobrar', () => {
    rejectPayment(
      'The reading of invoice 7 is waiting for review: review it before collecting the payment',
    );

    expect(document.body.textContent).toContain('La lectura de esta factura está en revisión');
  });

  it('dice que se cobra la más reciente si la factura ya pasó a otra', () => {
    rejectPayment(
      'Invoice 7 is included as previous debt in a later invoice: work with the latest one',
    );

    expect(document.body.textContent).toContain('cobra la más reciente');
  });

  it('confirma el total de una factura de un solo servicio', () => {
    payments.pay(invoice(), 'CASH').subscribe();
    context.http.expectOne(DOCUMENT_URL).flush([invoice()]);

    expect(shown?.message).toContain('$ 25.500.');
    expect(shown?.message).not.toContain('documento completo');
  });

  it('en una factura conjunta confirma lo que de verdad se debe recibir', () => {
    const water = invoice();
    const sewerage = invoice({ id: 'alcantarillado', serviceType: 'SEWERAGE', total: 10000 });

    payments.pay(water, 'CASH').subscribe();
    context.http.expectOne(DOCUMENT_URL).flush([water, sewerage]);

    expect(shown?.message).toContain('por $ 35.500.');
    expect(shown?.message).toContain('Acueducto $ 25.500');
    expect(shown?.message).toContain('Alcantarillado $ 10.000');
  });

  it('no suma los servicios del documento que ya están pagados', () => {
    const water = invoice();
    const paid = invoice({ id: 'pagada', serviceType: 'SANITATION', total: 7000, state: 'PAID' });

    payments.pay(water, 'BANK').subscribe();
    context.http.expectOne(DOCUMENT_URL).flush([water, paid]);

    expect(shown?.message).toContain('$ 25.500.');
    expect(shown?.message).not.toContain('Aseo');
  });

  it('avisa de la deuda anterior aunque esté en otro servicio del documento', () => {
    const water = invoice();
    const sewerage = invoice({ id: 'otra', serviceType: 'SEWERAGE', previousDebt: 3000 });

    payments.pay(water, 'CASH').subscribe();
    context.http.expectOne(DOCUMENT_URL).flush([water, sewerage]);

    expect(shown?.message).toContain('Incluye la deuda anterior');
  });
});
