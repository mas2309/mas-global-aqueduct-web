import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Invoice } from '../invoice.models';
import { InvoicesApi } from '../invoices-api';

/** Deshace un pago registrado por error, dejando el motivo. Devuelve la factura otra vez pendiente. */
@Component({
  selector: 'aq-reverse-payment-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Reversar el pago</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p>
          La factura n.º {{ invoice.number }} de {{ invoice.subscriberName }} volverá a quedar
          pendiente, junto con los demás servicios de ese documento y las anteriores que se saldaron
          con ese pago. Úsalo solo si el pago se
          registró por error.
        </p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Motivo</mat-label>
          <input matInput formControlName="reason" maxlength="200" autocomplete="off" />
          <mat-hint>Queda guardado con tu usuario y la fecha</mat-hint>
          @if (form.controls.reason.invalid) {
            <mat-error>Indica por qué se reversa el pago</mat-error>
          }
        </mat-form-field>
        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" class="danger" [disabled]="saving()">
          Reversar pago
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      margin-top: 12px;
    }

    .danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ReversePaymentDialog {
  private readonly api = inject(InvoicesApi);
  private readonly dialogRef = inject<MatDialogRef<ReversePaymentDialog, Invoice>>(MatDialogRef);
  protected readonly invoice = inject<Invoice>(MAT_DIALOG_DATA);

  protected readonly form = inject(NonNullableFormBuilder).group({
    reason: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.reversePayment(this.invoice.id, this.form.getRawValue().reason.trim()).subscribe({
      next: (invoice) => this.dialogRef.close(invoice),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            403: 'Solo el administrador del prestador reversa pagos.',
            409: 'Esta factura no está pagada.',
            422: 'El predio ya tiene una factura posterior, liquidada contando con este pago: no se puede reversar.',
          }),
        );
      },
    });
  }
}
