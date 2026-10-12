import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session-store';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { saveFile } from '../../../shared/ui/save-file';
import { periodLabel } from '../../readings/reading.models';
import { formatCode } from '../../subscribers/subscriber.models';
import { unitOf } from '../../tariffs/tariff.models';
import { InvoicePayments } from '../invoice-payments';
import {
  Invoice,
  INVOICE_STATE_LABELS,
  isOpen,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
} from '../invoice.models';
import { INVOICES_URL, InvoicesApi } from '../invoices-api';
import { OtherChargesDialog } from '../other-charges-dialog/other-charges-dialog';

/** Una factura con el desglose de lo que cobra, y las acciones de recaudo y otros cobros. */
@Component({
  selector: 'aq-invoice-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './invoice-detail.html',
  styleUrl: './invoice-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetail {
  private readonly api = inject(InvoicesApi);
  private readonly dialog = inject(MatDialog);
  private readonly payments = inject(InvoicePayments);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Parámetro de ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly invoice = httpResource<Invoice>(() => `${INVOICES_URL}/${this.id()}`);

  protected readonly stateLabels = INVOICE_STATE_LABELS;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly periodLabel = periodLabel;
  protected readonly formatCode = formatCode;
  protected readonly unitOf = unitOf;
  protected readonly isOpen = isOpen;

  protected download(invoice: Invoice): void {
    this.api.pdf(invoice.id).subscribe({
      next: (pdf) => saveFile(pdf, `factura-${invoice.number}.pdf`),
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }

  protected pay(invoice: Invoice, method: PaymentMethod): void {
    this.payments.pay(invoice, method).subscribe({
      next: (paid) => this.invoice.set(paid),
      error: () => undefined,
    });
  }

  protected editOtherCharges(invoice: Invoice): void {
    this.dialog
      .open<OtherChargesDialog, Invoice, Invoice>(OtherChargesDialog, {
        data: invoice,
        width: '480px',
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.invoice.set(updated);
          this.notifier.success('Otros cobros actualizados');
        }
      });
  }
}
