import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { problemMessage, toProblem } from '../../../core/api/problem';
import {
  Claim,
  CLAIM_DECISION_LABELS,
  CLAIM_DECISIONS,
  CLAIMS_URL,
  ClaimDecision,
} from '../claim.models';

/**
 * Responde una PQR. De lo congelado, el suscriptor no debe nada si es favorable y todo si es desfavorable; si es parcial
 * se indica cuánto. Eso se cobra en su siguiente factura. Devuelve la PQR.
 */
@Component({
  selector: 'aq-claim-answer-dialog',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Responder la PQR n.º {{ claim.number }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Decisión</mat-label>
          <mat-select formControlName="decision">
            @for (decision of decisions; track decision) {
              <mat-option [value]="decision">{{ labels[decision] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Respuesta</mat-label>
          <textarea matInput rows="5" formControlName="text" maxlength="2000"></textarea>
          @if (form.controls.text.invalid) {
            <mat-error>Escribe la respuesta</mat-error>
          }
        </mat-form-field>
        @if (claim.disputedAmount > 0) {
          @if (form.controls.decision.value === 'PARTIAL') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Lo que debe de lo congelado</mat-label>
              <input
                matInput
                type="number"
                min="0"
                [max]="claim.disputedAmount"
                formControlName="owedAmount"
              />
              <mat-hint>
                Congelado: {{ claim.disputedAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
              </mat-hint>
              @if (form.controls.owedAmount.invalid) {
                <mat-error>Indica un valor entre cero y lo congelado</mat-error>
              }
            </mat-form-field>
          } @else {
            <p class="muted">
              @if (form.controls.decision.value === 'FAVORABLE') {
                No se cobra nada de lo congelado.
              } @else {
                Lo congelado
                ({{ claim.disputedAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}) se cobra en
                su siguiente factura.
              }
            </p>
          }
        }
        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Responder</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ClaimAnswerDialog {
  private readonly http = inject(HttpClient);
  private readonly dialogRef = inject<MatDialogRef<ClaimAnswerDialog, Claim>>(MatDialogRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly claim = inject<Claim>(MAT_DIALOG_DATA);

  protected readonly decisions = CLAIM_DECISIONS;
  protected readonly labels = CLAIM_DECISION_LABELS;
  protected readonly form = this.fb.group({
    decision: this.fb.control<ClaimDecision>('FAVORABLE'),
    text: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(2000)]],
    owedAmount: this.fb.control<number | null>(null, [
      Validators.min(0),
      Validators.max(this.claim.disputedAmount),
    ]),
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    const { decision, text, owedAmount } = this.form.getRawValue();
    const partial = decision === 'PARTIAL' && this.claim.disputedAmount > 0;
    if (partial && owedAmount === null) {
      this.form.controls.owedAmount.setErrors({ required: true });
    }
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.http
      .post<Claim>(`${CLAIMS_URL}/${this.claim.id}/answer`, {
        decision,
        text: text.trim(),
        owedAmount: partial ? owedAmount : null,
      })
      .subscribe({
        next: (answered) => this.dialogRef.close(answered),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), {
              403: 'Tu rol solo permite consultar.',
              422: 'No se pudo responder: la PQR ya tiene respuesta, o el valor no corresponde a la decisión.',
            }),
          );
        },
      });
  }
}
