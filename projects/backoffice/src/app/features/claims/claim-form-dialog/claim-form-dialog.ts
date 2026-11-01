import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Invoice, isOpen } from '../../invoices/invoice.models';
import { INVOICES_URL } from '../../invoices/invoices-api';
import { Page } from '../../organizations/organization.models';
import { periodLabel } from '../../readings/reading.models';
import { formatCode, Property, Subscriber } from '../../subscribers/subscriber.models';
import { SUBSCRIBERS_URL } from '../../subscribers/subscribers-api';
import {
  Claim,
  CLAIM_CHANNEL_LABELS,
  CLAIM_CHANNELS,
  CLAIM_TYPE_LABELS,
  CLAIM_TYPES,
  CLAIMS_URL,
  ClaimChannel,
  ClaimType,
  NewClaim,
} from '../claim.models';

/** Radica una PQR: se busca el suscriptor y se llenan sus datos. Devuelve la PQR con su número. */
@Component({
  selector: 'aq-claim-form-dialog',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './claim-form-dialog.html',
  styles: `
    .search {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;

      mat-form-field {
        flex: 1;
      }
    }
    .results {
      margin: 12px 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
  `,
})
export class ClaimFormDialog {
  private readonly http = inject(HttpClient);
  private readonly dialogRef = inject<MatDialogRef<ClaimFormDialog, Claim>>(MatDialogRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly searchText = signal('');
  private readonly query = signal('');
  protected readonly results = httpResource<Page<Subscriber>>(() =>
    this.query() ? { url: SUBSCRIBERS_URL, params: { q: this.query(), size: 5 } } : undefined,
  );
  protected readonly subscriber = signal<Subscriber | null>(null);
  protected readonly properties = httpResource<Property[]>(() => {
    const subscriber = this.subscriber();
    return subscriber ? `${SUBSCRIBERS_URL}/${subscriber.id}/properties` : undefined;
  });
  protected readonly invoices = httpResource<Page<Invoice>>(() => {
    const subscriber = this.subscriber();
    return subscriber
      ? { url: INVOICES_URL, params: { subscriberId: subscriber.id, size: 12 } }
      : undefined;
  });

  protected readonly types = CLAIM_TYPES;
  protected readonly typeLabels = CLAIM_TYPE_LABELS;
  protected readonly channels = CLAIM_CHANNELS;
  protected readonly channelLabels = CLAIM_CHANNEL_LABELS;
  protected readonly formatCode = formatCode;
  protected readonly periodLabel = periodLabel;
  protected readonly isOpen = isOpen;

  protected readonly form = this.fb.group({
    type: this.fb.control<ClaimType>('PETITION'),
    channel: this.fb.control<ClaimChannel>('IN_PERSON'),
    cause: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    causeCode: ['', Validators.maxLength(20)],
    description: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(2000)]],
    propertyId: this.fb.control<string | null>(null),
    invoiceId: this.fb.control<string | null>(null),
    disputedAmount: this.fb.control<number | null>(null, [Validators.min(0)]),
    filedOn: [''],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected search(): void {
    this.query.set(this.searchText().trim());
  }

  protected submit(): void {
    const subscriber = this.subscriber();
    if (!subscriber || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const claim = value.type === 'CLAIM';
    const request: NewClaim = {
      subscriberId: subscriber.id,
      propertyId: value.propertyId,
      invoiceId: claim ? value.invoiceId : null,
      type: value.type,
      channel: value.channel,
      cause: value.cause.trim(),
      causeCode: value.causeCode.trim() || null,
      description: value.description.trim(),
      disputedAmount: claim && value.invoiceId ? value.disputedAmount : null,
      filedOn: value.filedOn || null,
    };
    this.saving.set(true);
    this.error.set(null);
    this.http.post<Claim>(CLAIMS_URL, request).subscribe({
      next: (filed) => this.dialogRef.close(filed),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            403: 'Tu rol solo permite consultar.',
            422: 'No se pudo radicar: el valor en reclamo supera lo que falta por pagar de la factura, o la factura ya no se puede congelar.',
          }),
        );
      },
    });
  }
}
