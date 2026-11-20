import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Claim, CLAIMS_URL } from '../claim.models';

/** Congela parte de la factura de un reclamo radicado sin valor, como los del portal. Devuelve la PQR. */
@Component({
  selector: 'aq-claim-freeze-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Congelar valor reclamado</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Valor a congelar</mat-label>
          <input matInput type="number" min="1" formControlName="amount" />
          <mat-hint>Deja de cobrarse mientras se resuelve. Solo se hace una vez</mat-hint>
          @if (form.controls.amount.invalid) {
            <mat-error>Indica un valor mayor que cero</mat-error>
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
        <button mat-flat-button type="submit" [disabled]="saving()">Congelar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ClaimFreezeDialog {
  private readonly http = inject(HttpClient);
  private readonly dialogRef = inject<MatDialogRef<ClaimFreezeDialog, Claim>>(MatDialogRef);
  private readonly claim = inject<Claim>(MAT_DIALOG_DATA);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.http
      .post<Claim>(`${CLAIMS_URL}/${this.claim.id}/freeze`, this.form.getRawValue())
      .subscribe({
        next: (frozen) => this.dialogRef.close(frozen),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), {
              403: 'Tu rol solo permite consultar.',
              422: 'No se pudo congelar: supera lo que queda por pagar, o la factura ya no se puede cambiar.',
            }),
          );
        },
      });
  }
}
