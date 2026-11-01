import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { filter, map, Observable, switchMap, tap } from 'rxjs';
import { SERVICE_LABELS } from '../../core/i18n/labels';
import { Notifier } from '../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { Invoice, isOpen, PAYMENT_METHOD_LABELS, PaymentMethod } from './invoice.models';
import { InvoicesApi } from './invoices-api';

const PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Registrar el pago de una factura, con confirmación: lo comparten el listado y el detalle. */
@Injectable({ providedIn: 'root' })
export class InvoicePayments {
  private readonly api = inject(InvoicesApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);

  /**
   * Emite la factura ya pagada; no emite si se cancela la confirmación o el servidor la rechaza. El servidor paga
   * el documento completo, así que la confirmación muestra lo que de verdad se debe recibir.
   */
  pay(invoice: Invoice, method: PaymentMethod): Observable<Invoice> {
    return this.api.document(invoice.id).pipe(
      map((document) => document.filter((other) => other.id !== invoice.id && isOpen(other))),
      switchMap((others) =>
        this.dialog
          .open(ConfirmDialog, { data: this.confirmation(invoice, others, method), width: '440px' })
          .afterClosed(),
      ),
      filter((confirmed) => confirmed === true),
      switchMap(() => this.api.pay(invoice.id, method)),
      tap({
        next: () => this.notifier.success(`Pago de la factura n.º ${invoice.number} registrado`),
        error: (error: unknown) =>
          this.notifier.apiError(error, {
            403: 'Tu rol solo permite consultar.',
            409: 'Esta factura ya estaba pagada.',
            422: 'Esta factura está incluida en una posterior: cobra la más reciente.',
          }),
      }),
    );
  }

  private confirmation(
    invoice: Invoice,
    others: Invoice[],
    method: PaymentMethod,
  ): ConfirmDialogData {
    const total = others.reduce((sum, other) => sum + other.total, invoice.total);
    const detail = [invoice, ...others]
      .map((item) => `${SERVICE_LABELS[item.serviceType]} $ ${PESOS.format(item.total)}`)
      .join(', ');
    return {
      title: `Registrar pago en ${PAYMENT_METHOD_LABELS[method].toLowerCase()}`,
      message:
        `Factura n.º ${invoice.number} de ${invoice.subscriberName} por $ ${PESOS.format(total)}.` +
        (others.length > 0 ? ` Se paga el documento completo: ${detail}.` : '') +
        ([invoice, ...others].some((item) => item.previousDebt > 0)
          ? ' Incluye la deuda anterior, que también queda saldada.'
          : ''),
      confirmLabel: 'Registrar pago',
    };
  }
}
