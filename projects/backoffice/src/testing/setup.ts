import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthResponse } from '../app/core/auth/auth.models';
import { REFRESH_TOKEN_STORAGE, SessionStore } from '../app/core/auth/session-store';
import { authResponse, MemoryStorage } from './fixtures';

export interface PageTestContext {
  http: HttpTestingController;
  router: Router;
  store: SessionStore;
}

/**
 * Configura una prueba de pantalla: HTTP simulado, router sin navegación real y una sesión iniciada.
 * Pasar `session: null` para probar sin sesión.
 */
export function setUpPage(
  options: { session?: AuthResponse | null; providers?: Provider[] } = {},
): PageTestContext {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: REFRESH_TOKEN_STORAGE, useValue: new MemoryStorage() },
      ...(options.providers ?? []),
    ],
  });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const store = TestBed.inject(SessionStore);
  const session = options.session === undefined ? authResponse() : options.session;
  if (session) {
    store.start(session);
  }
  return { http: TestBed.inject(HttpTestingController), router, store };
}

/**
 * Dispara efectos (p. ej. las peticiones de `httpResource`), deja que se resuelvan las respuestas ya simuladas y
 * vuelve a renderizar. A diferencia de `whenStable()`, no espera a que se respondan peticiones pendientes.
 */
export async function settle(): Promise<void> {
  TestBed.tick();
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

/** Escribe en un input y dispara el evento que escucha Angular. */
export function type(element: HTMLElement, selector: string, value: string): void {
  const input = element.querySelector<HTMLInputElement>(selector);
  if (!input) {
    throw new Error(`No input matches ${selector}`);
  }
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

export function click(element: HTMLElement, selector: string): void {
  const target = element.querySelector<HTMLElement>(selector);
  if (!target) {
    throw new Error(`No element matches ${selector}`);
  }
  target.click();
}

export function textOf(element: HTMLElement): string {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
