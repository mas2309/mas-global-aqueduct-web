import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { SessionStore } from '../../../core/auth/session-store';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { saveFile } from '../../../shared/ui/save-file';
import { periodLabel } from '../../readings/reading.models';
import { formatCode, METERED_SERVICES } from '../../subscribers/subscriber.models';
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
import { ReversePaymentDialog } from '../reverse-payment-dialog/reverse-payment-dialog';

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
  private readonly router = inject(Router);
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
  protected readonly meteredServices = METERED_SERVICES;
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

  protected reversePayment(invoice: Invoice): void {
    this.dialog
      .open<ReversePaymentDialog, Invoice, Invoice>(ReversePaymentDialog, {
        data: invoice,
        width: '480px',
      })
      .afterClosed()
      .subscribe((reopened) => {
        if (reopened) {
          this.invoice.set(reopened);
          this.notifier.success(`Pago de la factura n.º ${invoice.number} reversado`);
        }
      });
  }

  /** Solo para facturas de servicios sin medidor: las demás se retiran eliminando su lectura. */
  protected voidInvoice(invoice: Invoice): void {
    const data: ConfirmDialogData = {
      title: `Anular la factura n.º ${invoice.number}`,
      message:
        `Se elimina la factura de ${invoice.subscriberName}. Si incluía deuda de una factura anterior, ` +
        'esa vuelve a quedar pendiente. No se puede deshacer.',
      confirmLabel: 'Anular factura',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.api.voidInvoice(invoice.id)),
      )
      .subscribe({
        next: () => {
          this.notifier.success(`Factura n.º ${invoice.number} anulada`);
          void this.router.navigateByUrl('/facturas');
        },
        error: (error: unknown) =>
          this.notifier.apiError(error, {
            403: 'Solo el administrador del prestador anula facturas.',
            422: 'Esta factura ya está pagada o incluida en una posterior: no se puede anular.',
          }),
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
