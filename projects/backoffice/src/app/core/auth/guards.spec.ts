import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { access, authResponse, MemoryStorage, user } from '../../../testing/fixtures';
import {
  authGuard,
  guestGuard,
  organizationAdminGuard,
  organizationGuard,
  passwordChangedGuard,
  platformAdminGuard,
} from './guards';
import { REFRESH_TOKEN_STORAGE, SessionStore } from './session-store';

describe('guards', () => {
  let store: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: REFRESH_TOKEN_STORAGE, useValue: new MemoryStorage() },
      ],
    });
    store = TestBed.inject(SessionStore);
  });

  function run(guard: CanActivateFn, url = '/inicio'): boolean | string {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return result instanceof UrlTree ? result.toString() : (result as boolean);
  }

  it('authGuard envía al login recordando la página pedida', () => {
    expect(run(authGuard, '/prestadores')).toBe('/ingresar?volver=%2Fprestadores');
    store.start(authResponse());
    expect(run(authGuard)).toBe(true);
  });

  it('guestGuard saca del login a quien ya inició sesión', () => {
    expect(run(guestGuard)).toBe(true);
    store.start(authResponse());
    expect(run(guestGuard)).toBe('/inicio');
  });

  it('passwordChangedGuard obliga a cambiar una contraseña temporal', () => {
    store.start(authResponse({ user: user({ mustChangePassword: true }) }));
    expect(run(passwordChangedGuard)).toBe('/cambiar-clave');
    store.start(authResponse());
    expect(run(passwordChangedGuard)).toBe(true);
  });

  it('organizationGuard exige un prestador seleccionado', () => {
    store.start(authResponse({ organization: null }));
    expect(run(organizationGuard)).toBe('/seleccionar-prestador');
    store.start(authResponse({ organization: null, user: user({ platformAdmin: true }) }));
    expect(run(organizationGuard)).toBe('/prestadores');
    store.start(authResponse());
    expect(run(organizationGuard)).toBe(true);
  });

  it('organizationAdminGuard exige administrar el prestador seleccionado', () => {
    store.start(authResponse());
    expect(run(organizationAdminGuard)).toBe('/inicio');
    store.start(authResponse({ organization: null, user: user({ platformAdmin: true }) }));
    expect(run(organizationAdminGuard)).toBe('/inicio');
    store.start(authResponse({ organization: access({ role: 'ORG_ADMIN' }) }));
    expect(run(organizationAdminGuard)).toBe(true);
  });

  it('platformAdminGuard solo deja pasar al administrador de plataforma', () => {
    store.start(authResponse());
    expect(run(platformAdminGuard)).toBe('/inicio');
    store.start(authResponse({ user: user({ platformAdmin: true }) }));
    expect(run(platformAdminGuard)).toBe(true);
  });
});
