import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { Problem, problemMessage, toProblem } from '../../../core/api/problem';
import { AuthService } from '../../../core/auth/auth.service';
import { SessionStore } from '../../../core/auth/session-store';
import { Notifier } from '../../../core/ui/notifier';

/** Misma política que el backend (NIST): longitud mínima, no igual al correo ni a la actual. */
export const MIN_PASSWORD_LENGTH = 10;

function passwordsDiffer(group: AbstractControl): ValidationErrors | null {
  const { currentPassword, newPassword, confirmation } = group.value as Record<string, string>;
  const errors: ValidationErrors = {};
  if (newPassword && newPassword === currentPassword) {
    errors['sameAsCurrent'] = true;
  }
  if (confirmation && newPassword !== confirmation) {
    errors['mismatch'] = true;
  }
  return Object.keys(errors).length ? errors : null;
}

/** Motivos de rechazo del backend (detalle del 400), en español. */
const POLICY_MESSAGES: readonly [string, string][] = [
  ['different from the current', 'La nueva contraseña debe ser distinta de la actual.'],
  ['must not be the email', 'La contraseña no puede ser tu correo.'],
  ['too weak', 'La contraseña es demasiado débil: no uses un solo carácter repetido.'],
  ['at least', `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`],
  ['at most', 'La contraseña debe tener máximo 128 caracteres.'],
];

export function changePasswordError(problem: Problem): string {
  if (problem.status === 400) {
    const detail = problem.detail ?? '';
    const known = POLICY_MESSAGES.find(([fragment]) => detail.includes(fragment));
    return known ? known[1] : 'La nueva contraseña no cumple la política de seguridad.';
  }
  if (problem.status === 422) {
    return 'La contraseña actual es incorrecta.';
  }
  const message = problemMessage(problem);
  // El código ayuda a soporte a encontrar la causa en los registros del servidor
  return problem.status > 0 && ![401, 429].includes(problem.status)
    ? `${message} (código ${problem.status})`
    : message;
}

@Component({
  selector: 'aq-change-password',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './change-password.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  protected readonly minLength = MIN_PASSWORD_LENGTH;
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      currentPassword: ['', Validators.required],
      newPassword: [
        '',
        [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH), Validators.maxLength(128)],
      ],
      confirmation: ['', Validators.required],
    },
    { validators: passwordsDiffer },
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    if (newPassword.toLowerCase() === this.session.user()?.email.toLowerCase()) {
      this.error.set('La contraseña no puede ser tu correo.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.notifier.success('Contraseña actualizada. Cerramos tus otras sesiones abiertas.');
        void this.router.navigateByUrl(this.auth.landingRoute());
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(changePasswordError(toProblem(error)));
      },
    });
  }
}
