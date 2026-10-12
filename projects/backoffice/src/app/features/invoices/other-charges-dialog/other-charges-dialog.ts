import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Invoice } from '../invoice.models';
import { InvoicesApi } from '../invoices-api';

/** Otros cobros de una factura pendiente (reconexión, multa, materiales). Devuelve la factura actualizada. */
@Component({
  selector: 'aq-other-charges-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Otros cobros</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Valor</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" min="0" formControlName="amount" inputmode="numeric" />
          <mat-hint>Cero para quitar el cobro</mat-hint>
          @if (form.controls.amount.invalid) {
            <mat-error>Debe ser cero o más</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Concepto</mat-label>
          <input matInput formControlName="description" maxlength="100" autocomplete="off" />
          <mat-hint>Por ejemplo: Reconexión</mat-hint>
        </mat-form-field>
        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      margin-top: 12px;
    }
  `,
})
export class OtherChargesDialog {
  private readonly api = inject(InvoicesApi);
  private readonly dialogRef = inject<MatDialogRef<OtherChargesDialog, Invoice>>(MatDialogRef);
  private readonly invoice = inject<Invoice>(MAT_DIALOG_DATA);

  protected readonly form = inject(NonNullableFormBuilder).group({
    amount: [this.invoice.otherCharges, [Validators.required, Validators.min(0)]],
    description: [this.invoice.otherChargesDescription ?? '', Validators.maxLength(100)],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { amount, description } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api.changeOtherCharges(this.invoice.id, amount, description.trim() || null).subscribe({
      next: (invoice) => this.dialogRef.close(invoice),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            403: 'Tu rol solo permite consultar.',
            422: 'Esta factura ya está pagada o está incluida en una posterior.',
          }),
        );
      },
    });
  }
}
