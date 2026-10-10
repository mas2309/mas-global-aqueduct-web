import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { ROLE_LABELS } from '../../../core/i18n/labels';
import { applyServerErrors } from '../../../shared/forms/server-errors';
import { Member, ORGANIZATION_ROLES, ROLE_DESCRIPTIONS } from '../member.models';
import { MembersApi } from '../members-api';
import { generateTemporaryPassword } from '../temporary-password';

export interface AddMemberDialogData {
  organizationId: string;
  organizationName: string;
}

/** Misma política que el backend. */
const MIN_PASSWORD_LENGTH = 10;

/**
 * Da acceso al prestador. Si la persona no tiene cuenta se crea con una contraseña temporal, que el
 * administrador debe entregarle: por eso al terminar se muestra una vez. Devuelve el miembro agregado.
 */
@Component({
  selector: 'aq-add-member-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './add-member-dialog.html',
  styleUrl: './add-member-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddMemberDialog {
  private readonly api = inject(MembersApi);
  private readonly dialogRef = inject<MatDialogRef<AddMemberDialog, Member>>(MatDialogRef);
  protected readonly data = inject<AddMemberDialogData>(MAT_DIALOG_DATA);

  protected readonly roles = ORGANIZATION_ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly roleDescriptions = ROLE_DESCRIPTIONS;
  protected readonly minLength = MIN_PASSWORD_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: ['OPERATOR' as OrganizationRole, Validators.required],
    fullName: ['', [Validators.minLength(2), Validators.maxLength(150)]],
    password: ['', [Validators.minLength(MIN_PASSWORD_LENGTH), Validators.maxLength(128)]],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Cuenta recién creada: se muestra la contraseña temporal para entregarla. */
  protected readonly created = signal<{ member: Member; password: string } | null>(null);

  protected generatePassword(): void {
    this.form.controls.password.setValue(generateTemporaryPassword());
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, role, fullName, password } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .add(this.data.organizationId, {
        email: email.trim(),
        role,
        fullName: fullName.trim() || undefined,
        password: password || undefined,
      })
      .subscribe({
        next: (member) => {
          if (member.accountCreated) {
            this.saving.set(false);
            this.created.set({ member, password });
          } else {
            this.dialogRef.close(member);
          }
        },
        error: (error: unknown) => {
          this.saving.set(false);
          const problem = toProblem(error);
          if (applyServerErrors(this.form, problem)) {
            return;
          }
          const incomplete = !fullName.trim() || !password;
          this.error.set(
            problemMessage(problem, {
              400: incomplete
                ? 'Esta persona aún no tiene cuenta: escribe su nombre y una contraseña temporal.'
                : 'Revisa los datos. La contraseña temporal no puede ser el correo ni repetir un solo carácter.',
              403: 'No tienes permiso para administrar los usuarios de este prestador.',
              422: 'El prestador debe conservar al menos un administrador.',
            }),
          );
        },
      });
  }

  protected finish(): void {
    this.dialogRef.close(this.created()?.member);
  }
}
