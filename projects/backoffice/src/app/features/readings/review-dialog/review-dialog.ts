import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Reading, REVIEW_OUTCOME_LABELS, ReviewOutcome, ReviewRequest } from '../reading.models';
import { ReadingsApi } from '../readings-api';

export interface ReviewDialogData {
  reading: Reading;
  subscriberName: string;
  unit: string;
}

/** Resuelve una lectura con desviación: confirmarla, corregirla o facturar el promedio. Devuelve la lectura. */
@Component({
  selector: 'aq-review-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Revisar la lectura</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p>
          {{ data.subscriberName }}: consumo de {{ data.reading.consumption }} {{ data.unit }}, muy
          distinto a su promedio. La factura se genera cuando resuelvas la revisión.
        </p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Resultado</mat-label>
          <mat-select formControlName="outcome">
            @for (outcome of outcomes; track outcome) {
              <mat-option [value]="outcome">{{ labels[outcome] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (form.controls.outcome.value === 'CORRECT') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Lectura correcta</mat-label>
            <input matInput type="number" min="0" step="any" formControlName="currentReading" />
            @if (form.controls.currentReading.invalid) {
              <mat-error>Indica la lectura correcta</mat-error>
            }
          </mat-form-field>
        }
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Qué se encontró</mat-label>
          <input matInput formControlName="notes" maxlength="300" autocomplete="off" />
          @if (form.controls.notes.invalid) {
            <mat-error>Indica qué se encontró al revisar</mat-error>
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
        <button mat-flat-button type="submit" [disabled]="saving()">Resolver y facturar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ReviewDialog {
  private readonly api = inject(ReadingsApi);
  private readonly dialogRef = inject<MatDialogRef<ReviewDialog, Reading>>(MatDialogRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly data = inject<ReviewDialogData>(MAT_DIALOG_DATA);

  protected readonly outcomes: readonly ReviewOutcome[] = ['CONFIRM', 'CORRECT', 'ESTIMATE'];
  protected readonly labels = REVIEW_OUTCOME_LABELS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    outcome: this.fb.control<ReviewOutcome>('CONFIRM'),
    currentReading: this.fb.control<number | null>(this.data.reading.currentReading, [
      Validators.min(0),
    ]),
    notes: ['', [Validators.required, Validators.pattern(/\S/)]],
  });

  protected submit(): void {
    const { outcome, currentReading, notes } = this.form.getRawValue();
    if (outcome === 'CORRECT' && currentReading === null) {
      this.form.controls.currentReading.setErrors({ required: true });
    }
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const request: ReviewRequest = {
      outcome,
      notes: notes.trim(),
      currentReading: outcome === 'CORRECT' ? (currentReading ?? undefined) : undefined,
    };
    this.saving.set(true);
    this.error.set(null);
    this.api.review(this.data.reading.id, request).subscribe({
      next: (reading) => this.dialogRef.close(reading),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            403: 'Tu rol solo permite consultar.',
            422:
              'No se pudo resolver: el periodo está cerrado, la lectura ya se revisó o el predio no tiene ' +
              'historia para estimar.',
          }),
        );
      },
    });
  }
}
