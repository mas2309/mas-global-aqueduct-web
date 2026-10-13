import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { GlobalCharge } from '../invoice.models';
import { InvoicesApi } from '../invoices-api';

/** Crea un cobro global para todos los suscriptores activos. Devuelve el cobro creado. */
@Component({
  selector: 'aq-global-charge-dialog',
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
    <h2 mat-dialog-title>Nuevo cobro global</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="muted">
          Se le cobra a cada suscriptor activo, en sus próximas facturas. Quien se registre después
          no lo recibe automáticamente.
        </p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Concepto</mat-label>
          <input matInput formControlName="description" maxlength="100" autocomplete="off" />
          <mat-hint>Por ejemplo: Aporte para el tanque</mat-hint>
          @if (form.controls.description.invalid) {
            <mat-error>Indica qué se cobra</mat-error>
          }
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Valor por suscriptor</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input matInput type="number" min="1" formControlName="amount" inputmode="numeric" />
            @if (form.controls.amount.invalid) {
              <mat-error>Debe ser mayor que cero</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Cuotas</mat-label>
            <input
              matInput
              type="number"
              min="1"
              max="120"
              formControlName="installments"
              inputmode="numeric"
            />
            @if (form.controls.installments.invalid) {
              <mat-error>Entre 1 y 120</mat-error>
            }
          </mat-form-field>
        </div>
        @if (installment(); as value) {
          <p class="muted">
            Cada factura cobrará cerca de {{ value | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}.
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
        <button mat-flat-button type="submit" [disabled]="saving()">Crear cobro</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      margin-top: 12px;
    }

    .row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 12px;
    }
  `,
})
export class GlobalChargeDialog {
  private readonly api = inject(InvoicesApi);
  private readonly dialogRef = inject<MatDialogRef<GlobalChargeDialog, GlobalCharge>>(MatDialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    description: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    amount: [0, [Validators.required, Validators.min(1)]],
    installments: [1, [Validators.required, Validators.min(1), Validators.max(120)]],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  /** Valor aproximado de cada cuota, cuando los datos ya sirven para calcularlo. */
  protected readonly installment = computed(() => {
    const { amount, installments } = this.value();
    return amount && installments && amount > 0 && installments > 0 ? amount / installments : null;
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { description, amount, installments } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .createGlobalCharge({ description: description.trim(), amount, installments })
      .subscribe({
        next: (charge) => this.dialogRef.close(charge),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), {
              403: 'Solo el administrador del prestador crea cobros globales.',
              422: 'No hay suscriptores activos a quién cobrarle.',
            }),
          );
        },
      });
  }
}
