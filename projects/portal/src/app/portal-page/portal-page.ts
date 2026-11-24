import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CLAIM_STATE_LABELS,
  CLAIM_TYPE_LABELS,
  CLAIM_TYPES,
  ClaimType,
  isPayable,
  periodLabel,
  PortalClaim,
  PortalClaimRequest,
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
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './portal-page.html',
  styleUrl: './portal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalPage {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(NonNullableFormBuilder);

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

  protected readonly claimForm = this.fb.group({
    type: this.fb.control<ClaimType>('PETITION'),
    invoiceId: this.fb.control<string | null>(null),
    cause: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
  });
  protected readonly writing = signal(false);
  protected readonly sending = signal(false);
  protected readonly filed = signal<PortalClaim | null>(null);
  protected readonly claimError = signal<string | null>(null);

  protected readonly claimTypes = CLAIM_TYPES;
  protected readonly claimTypeLabels = CLAIM_TYPE_LABELS;
  protected readonly claimStateLabels = CLAIM_STATE_LABELS;
  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly stateLabels = STATE_LABELS;
  protected readonly periodLabel = periodLabel;
  protected readonly unitOf = unitOf;

  protected startClaim(): void {
    this.claimForm.reset();
    this.claimError.set(null);
    this.filed.set(null);
    this.writing.set(true);
  }

  protected fileClaim(): void {
    const { type, invoiceId, cause, description } = this.claimForm.getRawValue();
    if (this.claimForm.invalid || !cause.trim() || !description.trim() || this.sending()) {
      this.claimForm.markAllAsTouched();
      this.claimError.set('Escribe el motivo y la descripción.');
      return;
    }
    const request: PortalClaimRequest = {
      type,
      cause: cause.trim(),
      description: description.trim(),
      invoiceId: type === 'CLAIM' ? invoiceId : null,
    };
    this.sending.set(true);
    this.claimError.set(null);
    this.http.post<PortalClaim>(`${this.baseUrl()}/claims`, request).subscribe({
      next: (claim) => {
        this.sending.set(false);
        this.writing.set(false);
        this.filed.set(claim);
        this.statement.reload();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.claimError.set(this.claimFailure(error));
      },
    });
  }

  private claimFailure(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 404) {
      return 'Este enlace ya no es válido. Escanea el código QR de tu factura más reciente.';
    }
    if (status === 422) {
      return 'Ya radicaste varias PQR hoy. Vuelve a intentarlo mañana o acércate a la oficina.';
    }
    return status === 429
      ? 'Demasiadas consultas. Espera un minuto y vuelve a intentarlo.'
      : 'No pudimos radicar tu PQR. Revisa tu conexión y vuelve a intentarlo.';
  }

  /** El PDF se abre con un enlace normal: la API pública no pide sesión. */
  protected pdfUrl(invoice: PortalInvoice): string {
    return `${this.baseUrl()}/invoices/${invoice.id}/pdf`;
  }
}
