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

  beforeEach(() => {
    shown = undefined;
    context = setUpPage({
      providers: [
        {
          provide: MatDialog,
          useValue: {
            open: (_component: unknown, config: { data: ConfirmDialogData }) => {
              shown = config.data;
              return { afterClosed: () => of(false) };
            },
          },
        },
      ],
    });
    payments = TestBed.inject(InvoicePayments);
  });

  afterEach(() => context.http.verify());

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
