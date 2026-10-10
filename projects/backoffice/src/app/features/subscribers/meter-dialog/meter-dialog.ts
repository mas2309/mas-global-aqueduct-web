import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { ServiceType } from '../../organizations/organization.models';
import { Property } from '../subscriber.models';
import { SubscribersApi } from '../subscribers-api';

export interface MeterDialogData {
  propertyId: string;
  serviceType: ServiceType;
  /** Medidor actual, si el servicio ya está conectado. */
  currentMeter: string | null;
  /** `true` si el servicio ya está conectado y solo se cambia el medidor. */
  connected: boolean;
}

/**
 * Conecta un servicio medido a un predio o cambia su medidor. El medidor es opcional: sin él, el servicio se
 * factura con cargo fijo o consumo promedio. Devuelve el predio actualizado.
 */
@Component({
  selector: 'aq-meter-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ data.connected ? 'Cambiar medidor de' : 'Conectar' }} {{ serviceLabel }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Serial del medidor (opcional)</mat-label>
          <input matInput formControlName="meterSerial" cdkFocusInitial autocomplete="off" />
          <mat-hint>Déjalo vacío si el predio no tiene medidor</mat-hint>
          @if (form.controls.meterSerial.invalid) {
            <mat-error>Máximo 40 caracteres</mat-error>
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
        <button mat-flat-button type="submit" [disabled]="saving()">
          {{ data.connected ? 'Guardar' : 'Conectar' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class MeterDialog {
  private readonly api = inject(SubscribersApi);
  private readonly dialogRef = inject<MatDialogRef<MeterDialog, Property>>(MatDialogRef);
  protected readonly data = inject<MeterDialogData>(MAT_DIALOG_DATA);

  protected readonly serviceLabel = SERVICE_LABELS[this.data.serviceType].toLowerCase();
  protected readonly form = inject(NonNullableFormBuilder).group({
    meterSerial: [this.data.currentMeter ?? '', Validators.maxLength(40)],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const meterSerial = this.form.getRawValue().meterSerial.trim() || null;
    this.saving.set(true);
    this.error.set(null);
    this.api.connectService(this.data.propertyId, this.data.serviceType, meterSerial).subscribe({
      next: (property) => this.dialogRef.close(property),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            403: 'Tu rol solo permite consultar.',
            409: 'Ese medidor ya está instalado en otro predio.',
            422: 'El prestador no ofrece este servicio.',
          }),
        );
      },
    });
  }
}
