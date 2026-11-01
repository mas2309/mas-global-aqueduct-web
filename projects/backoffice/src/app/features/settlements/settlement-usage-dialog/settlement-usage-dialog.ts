import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Settlement, SETTLEMENTS_URL } from '../settlement.models';

/** Consumos del mes en un borrador: facturas electrónicas y lo que reporta el banco. Devuelve la liquidación. */
@Component({
  selector: 'aq-settlement-usage-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Consumos de {{ settlement.organizationName }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Facturas electrónicas</mat-label>
          <input matInput type="number" min="0" formControlName="electronicInvoices" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Pagos Bre-B exitosos</mat-label>
          <input matInput type="number" min="0" formControlName="brebPayments" />
          <mat-hint>Según el reporte mensual del banco</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Dispersiones</mat-label>
          <input matInput type="number" min="0" formControlName="dispersions" />
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
})
export class SettlementUsageDialog {
  private readonly http = inject(HttpClient);
  private readonly dialogRef =
    inject<MatDialogRef<SettlementUsageDialog, Settlement>>(MatDialogRef);
  protected readonly settlement = inject<Settlement>(MAT_DIALOG_DATA);

  protected readonly form = inject(NonNullableFormBuilder).group({
    electronicInvoices: [
      this.settlement.electronicInvoices,
      [Validators.required, Validators.min(0)],
    ],
    brebPayments: [this.settlement.brebPayments, [Validators.required, Validators.min(0)]],
    dispersions: [this.settlement.dispersions, [Validators.required, Validators.min(0)]],
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
      .put<Settlement>(`${SETTLEMENTS_URL}/${this.settlement.id}/usage`, this.form.getRawValue())
      .subscribe({
        next: (saved) => this.dialogRef.close(saved),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), {
              422: 'No se pudo guardar: ya está emitida, o falta configurar el precio de la factura electrónica.',
            }),
          );
        },
      });
  }
}
