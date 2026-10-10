import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { AuthResponse, OrganizationAccess, Profile, User } from './auth.models';

/**
 * Almacenamiento del token de refresco. `sessionStorage`: la sesión termina al cerrar la pestaña, lo más seguro
 * en computadores compartidos de oficinas rurales. El token de acceso nunca se guarda: vive solo en memoria.
 */
export const REFRESH_TOKEN_STORAGE = new InjectionToken<Storage>('REFRESH_TOKEN_STORAGE', {
  factory: () => sessionStorage,
});

const REFRESH_TOKEN_KEY = 'aq.refreshToken';

interface SessionState {
  accessToken: string;
  user: User;
  organization: OrganizationAccess | null;
  organizations: OrganizationAccess[];
}

/** Estado de la sesión como signals: la interfaz reacciona sola al iniciar sesión o cambiar de prestador. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly storage = inject(REFRESH_TOKEN_STORAGE);
  private readonly state = signal<SessionState | null>(null);

  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly user = computed(() => this.state()?.user ?? null);
  readonly organization = computed(() => this.state()?.organization ?? null);
  readonly organizations = computed(() => this.state()?.organizations ?? []);
  readonly isPlatformAdmin = computed(() => this.user()?.platformAdmin ?? false);
  readonly mustChangePassword = computed(() => this.user()?.mustChangePassword ?? false);
  /** Puede administrar el prestador actual (usuarios, configuración). */
  readonly canAdministerOrganization = computed(
    () => this.isPlatformAdmin() || this.organization()?.role === 'ORG_ADMIN',
  );

  accessToken(): string | null {
    return this.state()?.accessToken ?? null;
  }

  refreshToken(): string | null {
    try {
      return this.storage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  start(response: AuthResponse): void {
    this.state.set({
      accessToken: response.accessToken,
      user: response.user,
      organization: response.organization,
      organizations: response.organizations,
    });
    try {
      this.storage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    } catch {
      // Almacenamiento bloqueado (modo privado): la sesión dura mientras la página esté abierta
    }
  }

  updateProfile(profile: Profile): void {
    this.state.update((current) =>
      current
        ? {
            ...current,
            user: profile.user,
            organization: profile.organization,
            organizations: profile.organizations,
          }
        : current,
    );
  }

  clear(): void {
    this.state.set(null);
    try {
      this.storage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Nada que limpiar
    }
  }
}
