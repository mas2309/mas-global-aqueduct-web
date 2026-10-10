import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { access, authResponse, MemoryStorage, UTILITY_ID, user } from '../../../testing/fixtures';
import { AUTH_URL } from './auth-api';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_STORAGE, SessionStore } from './session-store';

describe('AuthService', () => {
  let service: AuthService;
  let store: SessionStore;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: REFRESH_TOKEN_STORAGE, useValue: new MemoryStorage() },
      ],
    });
    service = TestBed.inject(AuthService);
    store = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('inicia sesión y guarda la sesión', async () => {
    const result = firstValueFrom(service.login('  ana@elhato.co ', 'clave-segura'));

    const request = http.expectOne(`${AUTH_URL}/login`);
    expect(request.request.body).toEqual({ email: 'ana@elhato.co', password: 'clave-segura' });
    request.flush(authResponse());

    await result;
    expect(store.isAuthenticated()).toBe(true);
    expect(service.landingRoute()).toBe('/inicio');
  });

  it('comparte una sola renovación entre peticiones concurrentes', async () => {
    store.start(authResponse());

    const first = firstValueFrom(service.refresh());
    const second = firstValueFrom(service.refresh());

    const request = http.expectOne(`${AUTH_URL}/refresh`);
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    request.flush(authResponse({ accessToken: 'access-2', refreshToken: 'refresh-2' }));

    await Promise.all([first, second]);
    expect(store.accessToken()).toBe('access-2');
    expect(store.refreshToken()).toBe('refresh-2');

    // Terminada, la siguiente renovación es una petición nueva
    void firstValueFrom(service.refresh());
    http.expectOne(`${AUTH_URL}/refresh`).flush(authResponse({ refreshToken: 'refresh-3' }));
  });

  it('cambia de prestador renovando con organizationId', async () => {
    store.start(authResponse());
    const result = firstValueFrom(service.selectOrganization(UTILITY_ID));

    const request = http.expectOne(`${AUTH_URL}/refresh`);
    expect(request.request.body.organizationId).toBe(UTILITY_ID);
    request.flush(authResponse({ organization: access({ organizationId: UTILITY_ID }) }));

    await result;
    expect(store.organization()?.organizationId).toBe(UTILITY_ID);
  });

  it('no renueva sin sesión', async () => {
    await expect(firstValueFrom(service.refresh())).rejects.toThrow('No active session');
  });

  it('recupera la sesión al recargar y la limpia si ya no es válida', async () => {
    await service.restore();

    store.start(authResponse());
    const restored = service.restore();
    http.expectOne(`${AUTH_URL}/refresh`).flush(authResponse({ accessToken: 'access-2' }));
    await restored;
    expect(store.accessToken()).toBe('access-2');

    const failed = service.restore();
    http.expectOne(`${AUTH_URL}/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await failed;
    expect(store.isAuthenticated()).toBe(false);
  });

  it('cambia la contraseña e inicia una sesión nueva con el mismo prestador', async () => {
    store.start(authResponse({ user: user({ mustChangePassword: true }) }));
    expect(service.landingRoute()).toBe('/cambiar-clave');

    const result = firstValueFrom(service.changePassword('temporal-123', 'nueva-clave-segura'));
    http.expectOne(`${AUTH_URL}/password`).flush(null);
    const login = http.expectOne(`${AUTH_URL}/login`);
    expect(login.request.body).toEqual({
      email: 'ana@elhato.co',
      password: 'nueva-clave-segura',
      organizationId: access().organizationId,
    });
    login.flush(authResponse());

    await result;
    expect(store.mustChangePassword()).toBe(false);
  });

  it('cierra sesión en el servidor y localmente, aunque el servidor falle', async () => {
    store.start(authResponse());
    const done = firstValueFrom(service.logout(), { defaultValue: undefined });
    http.expectOne(`${AUTH_URL}/logout`).flush(null, { status: 500, statusText: 'Error' });
    await done;

    expect(store.isAuthenticated()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/ingresar');
  });

  it('expira la sesión volviendo al login con aviso', () => {
    store.start(authResponse());
    service.expireSession();

    expect(store.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/ingresar'], {
      queryParams: { sesion: 'expirada' },
    });
  });

  it('elige la página de inicio según la sesión', () => {
    store.start(authResponse({ organization: null, organizations: [access(), access()] }));
    expect(service.landingRoute()).toBe('/seleccionar-prestador');

    store.start(authResponse({ organization: null, user: user({ platformAdmin: true }) }));
    expect(service.landingRoute()).toBe('/prestadores');
  });
});
