import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  EMPTY,
  finalize,
  firstValueFrom,
  Observable,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { AuthApi } from './auth-api';
import { AuthResponse } from './auth.models';
import { SessionStore } from './session-store';

export const LOGIN_ROUTE = '/ingresar';

/** Casos de uso de sesión: iniciar, renovar, cambiar de prestador, cambiar contraseña y salir. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly store = inject(SessionStore);
  private readonly router = inject(Router);

  /**
   * Renovación en curso. El backend rota el token de refresco y revoca la sesión si uno se usa dos veces, así
   * que las peticiones concurrentes que reciban 401 comparten una sola renovación.
   */
  private refreshInFlight: Observable<AuthResponse> | null = null;

  login(email: string, password: string, organizationId?: string): Observable<AuthResponse> {
    return this.api
      .login(email.trim(), password, organizationId)
      .pipe(tap((response) => this.store.start(response)));
  }

  /** Renueva la sesión; con `organizationId` además cambia al prestador indicado. */
  refresh(organizationId?: string): Observable<AuthResponse> {
    if (!organizationId && this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const refreshToken = this.store.refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No active session'));
    }
    const request = this.api.refresh(refreshToken, organizationId).pipe(
      tap((response) => this.store.start(response)),
      finalize(() => {
        if (this.refreshInFlight === request) {
          this.refreshInFlight = null;
        }
      }),
      shareReplay(1),
    );
    if (!organizationId) {
      this.refreshInFlight = request;
    }
    return request;
  }

  selectOrganization(organizationId: string): Observable<AuthResponse> {
    return this.refresh(organizationId);
  }

  /** Recupera la sesión al recargar la página, si la pestaña tiene un token de refresco vigente. */
  async restore(): Promise<void> {
    if (!this.store.refreshToken()) {
      return;
    }
    try {
      await firstValueFrom(this.refresh());
    } catch {
      this.store.clear();
    }
  }

  /**
   * El backend cierra todas las sesiones al cambiar la contraseña; se inicia una nueva con la contraseña nueva
   * y el mismo prestador para no obligar al usuario a ingresar otra vez.
   *
   * Si ese nuevo ingreso falla, la contraseña ya cambió: no se reporta como error (el usuario creería que no
   * cambió y volvería a intentarlo con la anterior), sino que se le pide ingresar con la nueva.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<AuthResponse> {
    const email = this.store.user()?.email ?? '';
    const organizationId = this.store.organization()?.organizationId;
    return this.api.changePassword(currentPassword, newPassword).pipe(
      switchMap(() =>
        this.login(email, newPassword, organizationId).pipe(
          catchError(() => {
            this.store.clear();
            void this.router.navigate([LOGIN_ROUTE], {
              queryParams: { sesion: 'clave-actualizada' },
            });
            return EMPTY;
          }),
        ),
      ),
    );
  }

  /** Cierra la sesión en el servidor (si falla, igual se cierra localmente). */
  logout(): Observable<void> {
    const refreshToken = this.store.refreshToken();
    const revoke = refreshToken ? this.api.logout(refreshToken) : EMPTY;
    return revoke.pipe(
      catchError(() => EMPTY),
      finalize(() => {
        this.store.clear();
        void this.router.navigateByUrl(LOGIN_ROUTE);
      }),
    );
  }

  /** La sesión ya no es válida (token revocado o vencido): vuelve al login avisando al usuario. */
  expireSession(): void {
    this.store.clear();
    void this.router.navigate([LOGIN_ROUTE], { queryParams: { sesion: 'expirada' } });
  }

  /** A dónde ir después de iniciar sesión o cambiar de prestador. */
  landingRoute(): string {
    if (this.store.mustChangePassword()) {
      return '/cambiar-clave';
    }
    if (this.store.organization()) {
      return '/inicio';
    }
    return this.store.isPlatformAdmin() ? '/prestadores' : '/seleccionar-prestador';
  }
}
