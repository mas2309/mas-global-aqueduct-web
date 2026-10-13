import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  isPayable,
  periodLabel,
  PortalInvoice,
  PortalStatement,
  SERVICE_LABELS,
  STATE_LABELS,
  unitOf,
} from '../portal.models';

export const PORTAL_URL = '/api/v1/public/portal';

/** Por qué no se pudo mostrar el portal. */
type Failure = 'INVALID_LINK' | 'TOO_MANY_REQUESTS' | 'UNAVAILABLE';

/**
 * Página del suscriptor: sus facturas recientes, lo que debe y el PDF de cada una. No hay sesión: la credencial
 * es el token de la dirección, que viene en el QR de la factura.
 */
@Component({
  selector: 'aq-portal-page',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './portal-page.html',
  styleUrl: './portal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalPage {
  /** Parámetro de ruta `:token`. */
  readonly token = input.required<string>();

  private readonly baseUrl = computed(() => `${PORTAL_URL}/${encodeURIComponent(this.token())}`);
  protected readonly statement = httpResource<PortalStatement>(() => this.baseUrl());

  protected readonly failure = computed<Failure | null>(() => {
    const error = this.statement.error();
    if (!error) {
      return null;
    }
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 404) {
      return 'INVALID_LINK';
    }
    return status === 429 ? 'TOO_MANY_REQUESTS' : 'UNAVAILABLE';
  });

  /** Facturas por pagar. Las incluidas en una posterior no cuentan: su valor ya va en esa. */
  protected readonly payable = computed(() =>
    this.statement.hasValue() ? this.statement.value().invoices.filter(isPayable) : [],
  );
  protected readonly debt = computed(() =>
    this.payable().reduce((sum, invoice) => sum + invoice.total, 0),
  );

  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly stateLabels = STATE_LABELS;
  protected readonly periodLabel = periodLabel;
  protected readonly unitOf = unitOf;

  /** El PDF se abre con un enlace normal: la API pública no pide sesión. */
  protected pdfUrl(invoice: PortalInvoice): string {
    return `${this.baseUrl()}/invoices/${invoice.id}/pdf`;
  }
}
