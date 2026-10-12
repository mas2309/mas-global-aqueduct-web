import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { filter, Observable, switchMap, tap } from 'rxjs';
import { Notifier } from '../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { Invoice, PAYMENT_METHOD_LABELS, PaymentMethod } from './invoice.models';
import { InvoicesApi } from './invoices-api';

const PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Registrar el pago de una factura, con confirmación: lo comparten el listado y el detalle. */
@Injectable({ providedIn: 'root' })
export class InvoicePayments {
  private readonly api = inject(InvoicesApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);

  /** Emite la factura ya pagada; no emite si se cancela la confirmación o el servidor la rechaza. */
  pay(invoice: Invoice, method: PaymentMethod): Observable<Invoice> {
    const data: ConfirmDialogData = {
      title: `Registrar pago en ${PAYMENT_METHOD_LABELS[method].toLowerCase()}`,
      message:
        `Factura n.º ${invoice.number} de ${invoice.subscriberName} por $ ${PESOS.format(invoice.total)}.` +
        (invoice.previousDebt > 0 ? ' Incluye la deuda anterior, que también queda saldada.' : ''),
      confirmLabel: 'Registrar pago',
    };
    return this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
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
}
