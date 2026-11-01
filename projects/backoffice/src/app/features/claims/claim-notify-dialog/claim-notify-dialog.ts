import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { problemMessage, toProblem } from '../../../core/api/problem';
import {
  Claim,
  CLAIM_CHANNEL_LABELS,
  CLAIM_CHANNELS,
  CLAIMS_URL,
  ClaimChannel,
} from '../claim.models';

/** Registra cómo y cuándo se le notificó la respuesta al suscriptor. Devuelve la PQR. */
@Component({
  selector: 'aq-claim-notify-dialog',
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
    <h2 mat-dialog-title>Registrar notificación</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Canal</mat-label>
          <mat-select formControlName="channel">
            @for (channel of channels; track channel) {
              <mat-option [value]="channel">{{ labels[channel] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Fecha</mat-label>
          <input matInput type="date" formControlName="notifiedOn" />
          <mat-hint>Vacía: hoy</mat-hint>
        </mat-form-field>
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
export class ClaimNotifyDialog {
  private readonly http = inject(HttpClient);
  private readonly dialogRef = inject<MatDialogRef<ClaimNotifyDialog, Claim>>(MatDialogRef);
  private readonly claim = inject<Claim>(MAT_DIALOG_DATA);

  protected readonly channels = CLAIM_CHANNELS;
  protected readonly labels = CLAIM_CHANNEL_LABELS;
  protected readonly form = inject(NonNullableFormBuilder).group({
    channel: ['WRITTEN' as ClaimChannel],
    notifiedOn: [''],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    const { channel, notifiedOn } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.http
      .post<Claim>(`${CLAIMS_URL}/${this.claim.id}/notify`, {
        channel,
        notifiedOn: notifiedOn || null,
      })
      .subscribe({
        next: (notified) => this.dialogRef.close(notified),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), {
              403: 'Tu rol solo permite consultar.',
              422: 'No se pudo registrar: revisa la fecha de la notificación.',
            }),
          );
        },
      });
  }
}
