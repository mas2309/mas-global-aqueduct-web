import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { BillingSettings } from '../invoice.models';
import { BILLING_SETTINGS_URL, InvoicesApi } from '../invoices-api';

/**
 * Reglas de facturación del prestador: hasta qué día se paga sin que la factura quede vencida y cuánto se
 * recarga cuando la anterior no se pagó. Devuelve la configuración guardada.
 */
@Component({
  selector: 'aq-billing-settings-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Plazo de pago y recargo</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="muted">
          Aplica a las facturas que se generen desde ahora; las ya emitidas no cambian.
        </p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Día límite de pago</mat-label>
          <input matInput type="number" min="1" max="31" formControlName="paymentDueDay" />
          <mat-hint>Del mes siguiente al periodo facturado</mat-hint>
          @if (form.controls.paymentDueDay.invalid) {
            <mat-error>Debe ser un día entre 1 y 31</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Recargo por no pago</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" min="0" formControlName="lateFee" inputmode="numeric" />
          <mat-hint>Se cobra cuando la factura anterior no se pagó. Cero para no cobrarlo</mat-hint>
          @if (form.controls.lateFee.invalid) {
            <mat-error>Debe ser cero o más</mat-error>
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
        <button mat-flat-button type="submit" [disabled]="saving() || !current.hasValue()">
          Guardar
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      margin-top: 12px;
    }
  `,
})
export class BillingSettingsDialog {
  private readonly api = inject(InvoicesApi);
  private readonly dialogRef =
    inject<MatDialogRef<BillingSettingsDialog, BillingSettings>>(MatDialogRef);

  protected readonly current = httpResource<BillingSettings>(() => BILLING_SETTINGS_URL);
  protected readonly form = inject(NonNullableFormBuilder).group({
    paymentDueDay: [20, [Validators.required, Validators.min(1), Validators.max(31)]],
    lateFee: [0, [Validators.required, Validators.min(0)]],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.current.hasValue()) {
        this.form.setValue(this.current.value());
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.updateSettings(this.form.getRawValue()).subscribe({
      next: (settings) => this.dialogRef.close(settings),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            403: 'Solo el administrador del prestador cambia esta configuración.',
          }),
        );
      },
    });
  }
}
