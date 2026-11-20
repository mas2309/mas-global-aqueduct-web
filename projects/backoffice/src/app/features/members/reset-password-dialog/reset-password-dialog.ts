import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Member } from '../member.models';
import { MembersApi } from '../members-api';
import { generateTemporaryPassword } from '../temporary-password';

export interface ResetPasswordDialogData {
  organizationId: string;
  member: Member;
}

/**
 * Contraseña temporal para un usuario que olvidó la suya. Se genera aquí, se asigna y se muestra una sola vez para
 * entregársela: deberá cambiarla al ingresar y sus sesiones abiertas se cierran. Devuelve `true` si se asignó.
 */
@Component({
  selector: 'aq-reset-password-dialog',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (done()) {
      <h2 mat-dialog-title>Contraseña restablecida</h2>
      <mat-dialog-content>
        <p>
          Entrégale a <strong>{{ data.member.fullName }}</strong> esta contraseña temporal:
        </p>
        <p class="password" aria-label="Contraseña temporal">{{ password }}</p>
        <p class="muted">
          Deberá cambiarla al ingresar. Sus sesiones abiertas se cerraron. Por seguridad no se
          volverá a mostrar.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-flat-button (click)="finish()" cdkFocusInitial>Listo</button>
      </mat-dialog-actions>
    } @else {
      <h2 mat-dialog-title>Restablecer contraseña</h2>
      <mat-dialog-content>
        <p>
          <strong>{{ data.member.fullName }}</strong> ({{ data.member.email }}) recibirá una
          contraseña temporal y deberá cambiarla al ingresar. Se cerrarán sus sesiones abiertas, en
          la web y en la app.
        </p>
        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button (click)="reset()" [disabled]="saving()">Restablecer</button>
      </mat-dialog-actions>
    }
  `,
  styles: `
    .password {
      padding: 12px;
      border-radius: 8px;
      font: var(--mat-sys-title-large);
      letter-spacing: 1px;
      text-align: center;
      background: var(--mat-sys-surface-container);
      user-select: all;
    }
  `,
})
export class ResetPasswordDialog {
  private readonly api = inject(MembersApi);
  private readonly dialogRef = inject<MatDialogRef<ResetPasswordDialog, boolean>>(MatDialogRef);
  protected readonly data = inject<ResetPasswordDialogData>(MAT_DIALOG_DATA);

  protected readonly password = generateTemporaryPassword();
  protected readonly saving = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  protected reset(): void {
    this.saving.set(true);
    this.error.set(null);
    this.api
      .resetPassword(this.data.organizationId, this.data.member.userId, this.password)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.done.set(true);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), {
              403: 'Solo el administrador del prestador restablece contraseñas.',
              422: 'Este usuario trabaja también en otros prestadores: su contraseña la restablece la plataforma.',
            }),
          );
        },
      });
  }

  protected finish(): void {
    this.dialogRef.close(true);
  }
}
