import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface DeliveryDialogData {
  title: string;
  message: string;
}

/** Fecha local de hoy en formato ISO: `toISOString` daría mañana en la noche de Colombia. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Pregunta la fecha de entrega de una factura o de las de un periodo. Devuelve la fecha ISO. */
@Component({
  selector: 'aq-delivery-dialog',
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Fecha de entrega</mat-label>
        <input
          matInput
          type="date"
          [ngModel]="deliveredOn()"
          (ngModelChange)="deliveredOn.set($event)"
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancelar</button>
      <button mat-flat-button [disabled]="!deliveredOn()" (click)="confirm()">Registrar</button>
    </mat-dialog-actions>
  `,
})
export class DeliveryDialog {
  private readonly dialogRef = inject<MatDialogRef<DeliveryDialog, string>>(MatDialogRef);
  protected readonly data = inject<DeliveryDialogData>(MAT_DIALOG_DATA);
  protected readonly deliveredOn = signal(today());

  protected confirm(): void {
    this.dialogRef.close(this.deliveredOn());
  }
}
