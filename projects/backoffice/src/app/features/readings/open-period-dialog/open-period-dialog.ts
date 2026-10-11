import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MONTH_OPTIONS } from '../reading.models';

export interface FirstPeriod {
  year: number;
  month: number;
}

/**
 * Elige el primer periodo del prestador. Los siguientes no se preguntan: siempre es el mes que sigue. Devuelve el
 * año y mes elegidos.
 */
@Component({
  selector: 'aq-open-period-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Primer periodo de facturación</h2>
    <mat-dialog-content>
      <p class="muted">
        Elige el mes desde el que empiezas a registrar lecturas. Después los periodos siguen en
        orden, uno por mes.
      </p>
      <div class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Mes</mat-label>
          <mat-select [ngModel]="month()" (ngModelChange)="month.set($event)">
            @for (option of months; track option.value) {
              <mat-option [value]="option.value">{{ option.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Año</mat-label>
          <input
            matInput
            type="number"
            min="2000"
            max="2100"
            [ngModel]="year()"
            (ngModelChange)="year.set(+$event)"
          />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="confirm()" [disabled]="year() < 2000 || year() > 2100">
        Abrir periodo
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .fields {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 12px;
    }
  `,
})
export class OpenPeriodDialog {
  private readonly dialogRef = inject<MatDialogRef<OpenPeriodDialog, FirstPeriod>>(MatDialogRef);

  protected readonly months = MONTH_OPTIONS;
  protected readonly year = signal(new Date().getFullYear());
  protected readonly month = signal(new Date().getMonth() + 1);

  protected confirm(): void {
    this.dialogRef.close({ year: this.year(), month: this.month() });
  }
}
