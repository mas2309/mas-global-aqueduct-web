import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Observable } from 'rxjs';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { saveFile } from '../../../shared/ui/save-file';
import { InvoicePayments } from '../../invoices/invoice-payments';
import { Invoice, isOpen, PaymentMethod } from '../../invoices/invoice.models';
import { INVOICES_URL, InvoicesApi } from '../../invoices/invoices-api';
import { Page } from '../../organizations/organization.models';
import { formatCode, Subscriber } from '../../subscribers/subscriber.models';
import { SUBSCRIBERS_URL } from '../../subscribers/subscribers-api';

/** Un documento por cobrar: los servicios que comparten número se pagan juntos. */
export interface PendingDocument {
  number: number;
  invoices: Invoice[];
  total: number;
}

/**
 * El enlace del portal que trae el QR de la factura, o solo su token. Un lector de códigos USB lo escribe en el
 * buscador como si fuera texto.
 */
export function looksLikeQr(text: string): boolean {
  return /^https?:\/\//i.test(text) || /^[A-Za-z0-9_-]{32,64}$/.test(text);
}

/**
 * Recaudo en la oficina o en un punto de recaudo: buscar al suscriptor (por código, nombre, documento o el QR de su
 * factura), cobrar lo que debe e imprimir el comprobante. Es la única pantalla del rol Recaudador.
 */
@Component({
  selector: 'aq-collection-page',
  imports: [
    CurrencyPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './collection-page.html',
  styleUrl: './collection-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPage {
  private readonly http = inject(HttpClient);
  private readonly api = inject(InvoicesApi);
  private readonly payments = inject(InvoicePayments);
  private readonly notifier = inject(Notifier);

  protected readonly query = signal('');
  protected readonly busy = signal(false);
  protected readonly searched = signal(false);
  protected readonly matches = signal<Subscriber[]>([]);
  protected readonly subscriber = signal<Subscriber | null>(null);
  protected readonly open = signal<Invoice[]>([]);
  /** La última factura que se cobró aquí, para imprimir su comprobante. */
  protected readonly paid = signal<Invoice | null>(null);
  protected readonly formatCode = formatCode;
  protected readonly serviceLabels = SERVICE_LABELS;

  protected readonly documents = computed<PendingDocument[]>(() => {
    const byNumber = new Map<number, Invoice[]>();
    for (const invoice of this.open()) {
      byNumber.set(invoice.number, [...(byNumber.get(invoice.number) ?? []), invoice]);
    }
    return [...byNumber.entries()].map(([number, invoices]) => ({
      number,
      invoices,
      total: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
    }));
  });

  protected search(): void {
    const text = this.query().trim();
    if (!text || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.paid.set(null);
    this.subscriber.set(null);
    this.matches.set([]);
    if (looksLikeQr(text)) {
      this.http
        .get<Subscriber>(`${SUBSCRIBERS_URL}/by-code`, { params: { code: text } })
        .subscribe({
          next: (found) => {
            this.searched.set(true);
            this.select(found);
          },
          error: () => {
            this.busy.set(false);
            this.searched.set(true);
            this.notifier.error('El código no corresponde a ningún suscriptor de este acueducto.');
          },
        });
      return;
    }
    this.http
      .get<Page<Subscriber>>(SUBSCRIBERS_URL, { params: { q: text, page: 0, size: 20 } })
      .subscribe({
        next: (page) => {
          this.busy.set(false);
          this.searched.set(true);
          if (page.items.length === 1) {
            this.select(page.items[0]);
          } else {
            this.matches.set(page.items);
          }
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.notifier.apiError(error);
        },
      });
  }

  protected select(subscriber: Subscriber): void {
    this.subscriber.set(subscriber);
    this.matches.set([]);
    this.loadOpen(subscriber.id);
  }

  protected pay(document: PendingDocument, method: PaymentMethod): void {
    // Se cobra la primera del documento: el servidor paga también los demás servicios
    this.payments.pay(document.invoices[0], method).subscribe((invoice) => {
      this.paid.set(invoice);
      const subscriber = this.subscriber();
      if (subscriber) {
        this.loadOpen(subscriber.id);
      }
    });
  }

  protected printReceipt(invoice: Invoice): void {
    this.show(this.api.receipt(invoice.id), `comprobante-${invoice.number}.pdf`);
  }

  protected printInvoice(invoice: Invoice): void {
    this.show(this.api.pdf(invoice.id), `factura-${invoice.number}.pdf`);
  }

  /** Nueva búsqueda: el siguiente suscriptor en la fila. */
  protected reset(): void {
    this.query.set('');
    this.subscriber.set(null);
    this.matches.set([]);
    this.open.set([]);
    this.paid.set(null);
    this.searched.set(false);
  }

  private loadOpen(subscriberId: string): void {
    this.busy.set(true);
    this.http
      .get<Page<Invoice>>(INVOICES_URL, { params: { subscriberId, page: 0, size: 50 } })
      .subscribe({
        next: (page) => {
          this.busy.set(false);
          this.open.set(page.items.filter(isOpen));
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.notifier.apiError(error);
        },
      });
  }

  /** Abre el PDF para imprimirlo; si el navegador bloquea la ventana, lo descarga. */
  private show(file: Observable<Blob>, name: string): void {
    file.subscribe({
      next: (pdf) => {
        const url = URL.createObjectURL(pdf);
        if (!window.open(url, '_blank')) {
          saveFile(pdf, name);
        }
      },
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }
}
