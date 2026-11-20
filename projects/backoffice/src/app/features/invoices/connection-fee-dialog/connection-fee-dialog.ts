import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';

export const CONNECTION_FEES_URL = '/api/v1/connection-fees';

export interface ConnectionFee {
  id: string;
  subscriberId: string;
  planId: string;
  directCost: number;
  administration: number;
  communityInvestment: number;
  additionalCost: number;
  additionalCostSupport: string | null;
  total: number;
  createdAt: string;
}

export interface ConnectionFeeDialogData {
  subscriberId: string;
  /** Solo a los asociados se les cobra el reconocimiento de inversiones comunitarias. */
  associate: boolean;
}

const COMPONENTS = [
  ['materials', 'Materiales'],
  ['metering', 'Medición'],
  ['storage', 'Almacenamiento'],
  ['labor', 'Mano de obra'],
  ['replacement', 'Reposición'],
  ['transport', 'Transporte'],
  ['territorial', 'Costos territoriales'],
  ['administration', 'Administración e imprevistos'],
] as const;

type ComponentName = (typeof COMPONENTS)[number][0];

/** Registra un aporte por conexión con su desglose (CRA 1038 de 2026): se cobra en cuotas. */
@Component({
  selector: 'aq-connection-fee-dialog',
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
    <h2 mat-dialog-title>Registrar aporte por conexión</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <div class="form-grid">
          @for (component of components; track component[0]) {
            <mat-form-field appearance="outline">
              <mat-label>{{ component[1] }}</mat-label>
              <input matInput type="number" min="0" [formControlName]="component[0]" />
            </mat-form-field>
          }
          @if (data.associate) {
            <mat-form-field appearance="outline">
              <mat-label>Inversiones comunitarias</mat-label>
              <input matInput type="number" min="0" formControlName="communityInvestment" />
            </mat-form-field>
          }
          <mat-form-field appearance="outline">
            <mat-label>Costos técnicos particulares</mat-label>
            <input matInput type="number" min="0" formControlName="additionalCost" />
          </mat-form-field>
        </div>
        @if (form.controls.additionalCost.value > 0) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Soporte de los costos particulares</mat-label>
            <input matInput formControlName="additionalCostSupport" maxlength="300" />
            @if (form.controls.additionalCostSupport.invalid) {
              <mat-error>Indica el soporte de estos costos</mat-error>
            }
          </mat-form-field>
        }
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Cuotas</mat-label>
          <input matInput type="number" min="1" max="120" formControlName="installments" />
          @if (form.controls.installments.invalid) {
            <mat-error>Entre 1 y 120 cuotas</mat-error>
          }
        </mat-form-field>
        <p>
          Total:
          <strong>{{ total() | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
        </p>
        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Registrar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ConnectionFeeDialog {
  private readonly http = inject(HttpClient);
  private readonly dialogRef =
    inject<MatDialogRef<ConnectionFeeDialog, ConnectionFee>>(MatDialogRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly data = inject<ConnectionFeeDialogData>(MAT_DIALOG_DATA);

  protected readonly components = COMPONENTS;
  protected readonly form = this.fb.group({
    materials: this.amount(),
    metering: this.amount(),
    storage: this.amount(),
    labor: this.amount(),
    replacement: this.amount(),
    transport: this.amount(),
    territorial: this.amount(),
    administration: this.amount(),
    communityInvestment: this.amount(),
    additionalCost: this.amount(),
    additionalCostSupport: [''],
    installments: [1, [Validators.required, Validators.min(1), Validators.max(120)]],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Solo orienta: el total definitivo y los topes los calcula el servidor. */
  protected total(): number {
    const value = this.form.getRawValue();
    const components = COMPONENTS.reduce(
      (sum, [name]: readonly [ComponentName, string]) => sum + (value[name] || 0),
      0,
    );
    return components + (value.communityInvestment || 0) + (value.additionalCost || 0);
  }

  private amount() {
    return this.fb.control(0, [Validators.required, Validators.min(0)]);
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    if (value.additionalCost > 0 && !value.additionalCostSupport.trim()) {
      this.form.controls.additionalCostSupport.setErrors({ required: true });
    }
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.http
      .post<ConnectionFee>(CONNECTION_FEES_URL, {
        ...value,
        subscriberId: this.data.subscriberId,
        communityInvestment: this.data.associate ? value.communityInvestment : 0,
        additionalCostSupport: value.additionalCostSupport.trim() || null,
      })
      .subscribe({
        next: (saved) => this.dialogRef.close(saved),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), {
              403: 'Tu rol solo permite consultar.',
              422: 'No se pudo registrar: la administración e imprevistos superan el tope, o el reconocimiento solo se cobra a asociados.',
            }),
          );
        },
      });
  }
}
