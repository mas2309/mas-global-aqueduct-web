import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { ALTITUDE_BANDS, ALTITUDE_LABELS, AltitudeBand } from '../../regulatory/regulatory.models';
import { SERVICE_AREAS_URL, ServiceArea, ServiceAreaRequest } from '../service-area.models';

/** Crea o edita un área de prestación. Devuelve el área guardada. */
@Component({
  selector: 'aq-service-area-dialog',
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
    <h2 mat-dialog-title>{{ area ? 'Editar área' : 'Nueva área' }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" maxlength="100" cdkFocusInitial />
          @if (form.controls.name.invalid) {
            <mat-error>Indica el nombre del área</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Código DANE del municipio (opcional)</mat-label>
          <input matInput formControlName="municipalityCode" maxlength="5" inputmode="numeric" />
          @if (form.controls.municipalityCode.invalid) {
            <mat-error>Debe tener 5 dígitos</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Altitud</mat-label>
          <mat-select formControlName="altitudeBand">
            <mat-option [value]="null">La del prestador</mat-option>
            @for (altitude of altitudes; track altitude) {
              <mat-option [value]="altitude">{{ altitudeLabels[altitude] }}</mat-option>
            }
          </mat-select>
          <mat-hint>Define el consumo básico de sus predios</mat-hint>
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
export class ServiceAreaDialog {
  private readonly http = inject(HttpClient);
  private readonly dialogRef = inject<MatDialogRef<ServiceAreaDialog, ServiceArea>>(MatDialogRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly area = inject<ServiceArea | undefined>(MAT_DIALOG_DATA);

  protected readonly altitudes = ALTITUDE_BANDS;
  protected readonly altitudeLabels = ALTITUDE_LABELS;
  protected readonly form = this.fb.group({
    name: [this.area?.name ?? '', [Validators.required, Validators.pattern(/\S/)]],
    municipalityCode: [this.area?.municipalityCode ?? '', [Validators.pattern(/^\d{5}$/)]],
    altitudeBand: this.fb.control<AltitudeBand | null>(this.area?.altitudeBand ?? null),
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, municipalityCode, altitudeBand } = this.form.getRawValue();
    const request: ServiceAreaRequest = {
      name: name.trim(),
      municipalityCode: municipalityCode.trim() || null,
      altitudeBand,
    };
    const save = this.area
      ? this.http.put<ServiceArea>(`${SERVICE_AREAS_URL}/${this.area.id}`, request)
      : this.http.post<ServiceArea>(SERVICE_AREAS_URL, request);
    this.saving.set(true);
    this.error.set(null);
    save.subscribe({
      next: (saved) => this.dialogRef.close(saved),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            403: 'Solo el administrador del prestador cambia las áreas.',
            409: 'Ya hay un área con ese nombre.',
            422: 'Ya hay un área con ese nombre.',
          }),
        );
      },
    });
  }
}
