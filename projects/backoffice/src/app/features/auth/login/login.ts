import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'aq-login',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Página a la que volver después de ingresar (query param `volver`). */
  readonly volver = input<string>();
  /** `expirada` cuando el login viene de una sesión vencida. */
  readonly sesion = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hidePassword = signal(true);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(email, password).subscribe({
      next: () => {
        const target = this.safeReturnUrl() ?? this.auth.landingRoute();
        void this.router.navigateByUrl(target);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            401: 'Correo o contraseña incorrectos. Tras varios intentos fallidos la cuenta se bloquea 15 minutos.',
          }),
        );
      },
    });
  }

  /** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
  private safeReturnUrl(): string | null {
    const url = this.volver();
    return url?.startsWith('/') && !url.startsWith('//') ? url : null;
  }
}
