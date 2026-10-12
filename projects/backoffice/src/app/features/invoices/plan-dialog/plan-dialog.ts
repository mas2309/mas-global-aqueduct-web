import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { InstallmentPlan } from '../invoice.models';
import { InvoicesApi } from '../invoices-api';

/** Crea una financiación para un suscriptor (el dato del diálogo es su id). Devuelve la financiación creada. */
@Component({
  selector: 'aq-plan-dialog',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Nueva financiación</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Concepto</mat-label>
          <input matInput formControlName="description" maxlength="100" autocomplete="off" />
          <mat-hint>Por ejemplo: Medidor nuevo, Matrícula, Acuerdo de pago</mat-hint>
          @if (form.controls.description.invalid) {
            <mat-error>Indica qué se financia</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Valor total</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" min="1" formControlName="totalAmount" inputmode="numeric" />
          @if (form.controls.totalAmount.invalid) {
            <mat-error>Debe ser mayor que cero</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Número de cuotas</mat-label>
          <input matInput type="number" min="1" max="120" formControlName="installments" />
          <mat-hint>Una cuota por factura</mat-hint>
          @if (form.controls.installments.invalid) {
            <mat-error>Entre 1 y 120 cuotas</mat-error>
          }
        </mat-form-field>
        @if (form.valid) {
          <p class="muted summary" aria-live="polite">
            Cada factura cobrará cerca de
            <strong>{{ installmentAmount() | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
          </p>
        }
        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Crear</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      margin-top: 12px;
    }

    .summary {
      margin: 12px 0 0;
    }
  `,
})
export class PlanDialog {
  private readonly api = inject(InvoicesApi);
  private readonly dialogRef = inject<MatDialogRef<PlanDialog, InstallmentPlan>>(MatDialogRef);
  private readonly subscriberId = inject<string>(MAT_DIALOG_DATA);

  protected readonly form = inject(NonNullableFormBuilder).group({
    description: ['', [Validators.required, Validators.maxLength(100)]],
    totalAmount: [0, [Validators.required, Validators.min(1)]],
    installments: [6, [Validators.required, Validators.min(1), Validators.max(120)]],
  });
  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected installmentAmount(): number {
    const { totalAmount, installments } = this.values();
    return installments ? (totalAmount ?? 0) / installments : 0;
  }

  protected submit(): void {
    if (this.form.invalid || !this.form.getRawValue().description.trim()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .createPlan({
        subscriberId: this.subscriberId,
        description: value.description.trim(),
        totalAmount: value.totalAmount,
        installments: value.installments,
      })
      .subscribe({
        next: (plan) => this.dialogRef.close(plan),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), { 403: 'Tu rol solo permite consultar.' }),
          );
        },
      });
  }
}
