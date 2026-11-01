import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { SessionStore } from '../../../core/auth/session-store';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { ServiceType } from '../../organizations/organization.models';
import {
  DISCONNECTIONS_URL,
  DisconnectionRules,
  RequestedAction,
  ServiceEvent,
} from '../disconnection.models';

export interface ServiceActionData {
  propertyId: string;
  address: string;
  serviceType: ServiceType;
  action: RequestedAction;
  /** Texto del botón: «Reconectar» o «Reinstalar» según el estado del servicio. */
  title: string;
}

/**
 * Registra una suspensión, un corte o un restablecimiento ya ejecutado en el predio, con su causal y su rastro. Si
 * restablecer exige estar al día, solo un administrador lo autoriza con deuda vencida. Devuelve el evento.
 */
@Component({
  selector: 'aq-service-action-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }} {{ serviceLabel }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="muted">{{ data.address }}</p>
        @if (restoring) {
          <p>Se registra el restablecimiento y su valor se cobra en la siguiente factura.</p>
        } @else {
          <p>Se registra lo que ya se ejecutó en el predio.</p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Causal</mat-label>
            <mat-select formControlName="cause">
              @for (cause of causes(); track cause) {
                <mat-option [value]="cause">{{ cause }}</mat-option>
              }
            </mat-select>
            @if (form.controls.cause.invalid) {
              <mat-error>Elige la causal</mat-error>
            }
          </mat-form-field>
        }
        <mat-form-field appearance="outline" class="full-width">
          <mat-label
            >Observaciones{{ form.controls.override.value ? '' : ' (opcional)' }}</mat-label
          >
          <input matInput formControlName="notes" maxlength="300" autocomplete="off" />
          @if (form.controls.notes.invalid) {
            <mat-error>Indica por qué se autoriza</mat-error>
          }
        </mat-form-field>
        @if (restoring && session.canAdministerOrganization()) {
          <mat-checkbox formControlName="override"
            >Autorizar aunque tenga deuda vencida</mat-checkbox
          >
        }
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
export class ServiceActionDialog {
  private readonly http = inject(HttpClient);
  private readonly dialogRef =
    inject<MatDialogRef<ServiceActionDialog, ServiceEvent>>(MatDialogRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly session = inject(SessionStore);
  protected readonly data = inject<ServiceActionData>(MAT_DIALOG_DATA);

  protected readonly restoring = this.data.action === 'RESTORE';
  protected readonly serviceLabel = SERVICE_LABELS[this.data.serviceType].toLowerCase();

  private readonly rules = httpResource<DisconnectionRules>(() =>
    this.restoring ? undefined : `${DISCONNECTIONS_URL}/rules`,
  );
  protected readonly causes = computed(() =>
    this.rules.hasValue() ? this.rules.value().causes : [],
  );

  protected readonly form = this.fb.group({
    cause: ['', this.restoring ? [] : [Validators.required]],
    notes: [''],
    override: [false],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    const { cause, notes, override } = this.form.getRawValue();
    if (override && !notes.trim()) {
      this.form.controls.notes.setErrors({ required: true });
    }
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const base = `${DISCONNECTIONS_URL}/properties/${this.data.propertyId}/services/${this.data.serviceType}`;
    const text = notes.trim() || null;
    const request = this.restoring
      ? this.http.post<ServiceEvent>(`${base}/restore`, { notes: text, override })
      : this.http.post<ServiceEvent>(`${base}/${this.data.action.toLowerCase()}`, {
          cause,
          notes: text,
        });
    this.saving.set(true);
    this.error.set(null);
    request.subscribe({
      next: (event) => this.dialogRef.close(event),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            403: 'Tu rol no permite esta acción.',
            422: this.restoring
              ? 'Tiene deuda vencida: debe estar al día o lo autoriza un administrador.'
              : 'El servicio no está en un estado que lo permita.',
          }),
        );
      },
    });
  }
}
