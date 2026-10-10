import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { applyServerErrors } from '../../../shared/forms/server-errors';
import {
  Property,
  PROPERTY_USAGE_LABELS,
  PROPERTY_USAGES,
  PropertyUsage,
  STRATA,
} from '../subscriber.models';
import { SubscribersApi } from '../subscribers-api';

export interface PropertyDialogData {
  subscriberId: string;
  /** Predio a editar; ausente para agregar uno nuevo. */
  property?: Property;
}

/** Agrega o edita un predio. Devuelve el predio guardado. */
@Component({
  selector: 'aq-property-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  templateUrl: './property-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyDialog {
  private readonly api = inject(SubscribersApi);
  private readonly dialogRef = inject<MatDialogRef<PropertyDialog, Property>>(MatDialogRef);
  protected readonly data = inject<PropertyDialogData>(MAT_DIALOG_DATA);

  protected readonly usages = PROPERTY_USAGES;
  protected readonly usageLabels = PROPERTY_USAGE_LABELS;
  protected readonly strata = STRATA;

  protected readonly form = inject(NonNullableFormBuilder).group({
    address: [
      this.data.property?.address ?? '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    ],
    sector: [this.data.property?.sector ?? '', Validators.maxLength(100)],
    usage: [this.data.property?.usage ?? ('RESIDENTIAL' as PropertyUsage), Validators.required],
    stratum: [this.data.property?.stratum ?? (null as number | null)],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Solo los predios residenciales tienen estrato. */
  protected isResidential(): boolean {
    return this.form.controls.usage.value === 'RESIDENTIAL';
  }

  protected submit(): void {
    const { address, sector, usage, stratum } = this.form.getRawValue();
    const residential = usage === 'RESIDENTIAL';
    if (this.form.invalid || (residential && stratum === null)) {
      this.form.markAllAsTouched();
      this.error.set(residential && stratum === null ? 'Selecciona el estrato del predio.' : null);
      return;
    }
    const request = {
      address: address.trim(),
      sector: sector.trim() || null,
      usage,
      stratum: residential ? stratum : null,
    };
    this.saving.set(true);
    this.error.set(null);
    const save = this.data.property
      ? this.api.updateProperty(this.data.property.id, request)
      : this.api.addProperty(this.data.subscriberId, request);
    save.subscribe({
      next: (property) => this.dialogRef.close(property),
      error: (error: unknown) => {
        this.saving.set(false);
        const problem = toProblem(error);
        if (!applyServerErrors(this.form, problem)) {
          this.error.set(
            problemMessage(problem, {
              403: 'Tu rol solo permite consultar.',
              422: 'No se pueden agregar predios a un suscriptor inactivo.',
            }),
          );
        }
      },
    });
  }
}
