import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, LOGIN_ROUTE } from './auth.service';
import { SessionStore } from './session-store';

/** Requiere sesión; si no hay, va al login y vuelve a la página pedida después de ingresar. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(SessionStore).isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree([LOGIN_ROUTE], { queryParams: { volver: state.url } });
};

/** El login solo se muestra sin sesión. */
export const guestGuard: CanActivateFn = () => {
  if (!inject(SessionStore).isAuthenticated()) {
    return true;
  }
  return inject(Router).parseUrl(inject(AuthService).landingRoute());
};

/** Con contraseña temporal solo se puede ir a cambiarla. */
export const passwordChangedGuard: CanActivateFn = () =>
  !inject(SessionStore).mustChangePassword() || inject(Router).parseUrl('/cambiar-clave');

/** Las pantallas operativas requieren un prestador seleccionado. */
export const organizationGuard: CanActivateFn = () => {
  const store = inject(SessionStore);
  return (
    store.organization() !== null ||
    inject(Router).parseUrl(store.isPlatformAdmin() ? '/prestadores' : '/seleccionar-prestador')
  );
};

/** Administrar los usuarios del prestador actual: su administrador o el de plataforma operando en él. */
export const organizationAdminGuard: CanActivateFn = () => {
  const store = inject(SessionStore);
  return (
    (store.organization() !== null && store.canAdministerOrganization()) ||
    inject(Router).parseUrl('/inicio')
  );
};

export const platformAdminGuard: CanActivateFn = () =>
  inject(SessionStore).isPlatformAdmin() || inject(Router).parseUrl('/inicio');
