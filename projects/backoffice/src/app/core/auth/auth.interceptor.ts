import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AUTH_URL } from './auth-api';
import { AuthService } from './auth.service';
import { SessionStore } from './session-store';

/** Endpoints que no llevan token ni deben disparar una renovación. */
const PUBLIC_ENDPOINTS = [`${AUTH_URL}/login`, `${AUTH_URL}/refresh`, `${AUTH_URL}/logout`];

/**
 * Agrega el token de acceso a las llamadas a la API. Si el servidor responde 401 (token vencido), renueva la
 * sesión una vez y reintenta; si la renovación falla, la sesión expiró.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/') || PUBLIC_ENDPOINTS.includes(request.url)) {
    return next(request);
  }
  const store = inject(SessionStore);
  const auth = inject(AuthService);

  return send(request, next, store.accessToken()).pipe(
    catchError((error: unknown) => {
      const expired =
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.Unauthorized;
      if (!expired || !store.refreshToken()) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        catchError(() => {
          auth.expireSession();
          return throwError(() => error);
        }),
        switchMap(() => send(request, next, store.accessToken())),
      );
    }),
  );
};

function send(request: HttpRequest<unknown>, next: HttpHandlerFn, accessToken: string | null) {
  return next(
    accessToken
      ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : request,
  );
}
