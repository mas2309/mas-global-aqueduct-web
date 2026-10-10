import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authResponse, MemoryStorage } from '../../../testing/fixtures';
import { AUTH_URL } from './auth-api';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_STORAGE, SessionStore } from './session-store';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let store: SessionStore;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: REFRESH_TOKEN_STORAGE, useValue: new MemoryStorage() },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
    auth = TestBed.inject(AuthService);
    store.start(authResponse());
  });

  afterEach(() => backend.verify());

  it('agrega el token de acceso a la API', async () => {
    const result = firstValueFrom(http.get('/api/v1/organizations'));

    const request = backend.expectOne('/api/v1/organizations');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush({});
    await result;
  });

  it('no agrega el token a otros dominios ni al login', async () => {
    const external = firstValueFrom(http.get('https://example.com/data'));
    const login = firstValueFrom(http.post(`${AUTH_URL}/login`, {}));

    const externalRequest = backend.expectOne('https://example.com/data');
    const loginRequest = backend.expectOne(`${AUTH_URL}/login`);
    expect(externalRequest.request.headers.has('Authorization')).toBe(false);
    expect(loginRequest.request.headers.has('Authorization')).toBe(false);
    externalRequest.flush({});
    loginRequest.flush({});
    await Promise.all([external, login]);
  });

  it('ante un 401 renueva una vez y reintenta con el token nuevo', async () => {
    const result = firstValueFrom(http.get<{ ok: boolean }>('/api/v1/organizations'));

    backend
      .expectOne('/api/v1/organizations')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne(`${AUTH_URL}/refresh`)
      .flush(authResponse({ accessToken: 'access-2', refreshToken: 'refresh-2' }));
    const retry = backend.expectOne('/api/v1/organizations');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ ok: true });

    expect(await result).toEqual({ ok: true });
  });

  it('si la renovación falla, la sesión expira', async () => {
    const expire = vi.spyOn(auth, 'expireSession').mockImplementation(() => undefined);
    const result = firstValueFrom(http.get('/api/v1/organizations'));

    backend
      .expectOne('/api/v1/organizations')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne(`${AUTH_URL}/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(expire).toHaveBeenCalled();
  });

  it('deja pasar los demás errores sin renovar', async () => {
    const result = firstValueFrom(http.get('/api/v1/organizations'));

    backend
      .expectOne('/api/v1/organizations')
      .flush(null, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ status: 403 });
  });
});
