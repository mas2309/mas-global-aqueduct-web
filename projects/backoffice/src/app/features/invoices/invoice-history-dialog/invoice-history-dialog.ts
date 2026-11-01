import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Invoice } from '../invoice.models';
import { INVOICES_URL } from '../invoices-api';

export interface InvoiceRevision {
  invoiceId: string;
  number: number;
  version: number;
  kind: 'REVISED' | 'VOIDED';
  reason: string | null;
  changedAt: string;
  total: number;
  dueDate: string;
}

/** Versiones anteriores de una factura, de la original a la más reciente. */
@Component({
  selector: 'aq-invoice-history-dialog',
  imports: [CurrencyPipe, DatePipe, MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Historial de la factura n.º {{ invoice.number }}</h2>
    <mat-dialog-content>
      @if (revisions.error()) {
        <p class="error" role="alert">No pudimos cargar el historial.</p>
      } @else if (revisions.hasValue()) {
        <ul class="revisions">
          @for (revision of revisions.value(); track revision.version) {
            <li>
              <strong>Versión {{ revision.version }}</strong>
              · {{ revision.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }} · pagar hasta
              {{ revision.dueDate | date: 'mediumDate' }}
              <br />
              <span class="muted">
                {{ revision.kind === 'VOIDED' ? 'Anulada' : 'Cambió' }} el
                {{ revision.changedAt | date: 'medium' }}
                @if (revision.reason) {
                  · {{ revision.reason }}
                }
              </span>
            </li>
          } @empty {
            <li class="muted">Esta factura no ha cambiado desde que se emitió.</li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .revisions {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
  `,
})
export class InvoiceHistoryDialog {
  protected readonly invoice = inject<Invoice>(MAT_DIALOG_DATA);
  protected readonly revisions = httpResource<InvoiceRevision[]>(
    () => `${INVOICES_URL}/${this.invoice.id}/history`,
  );
}
