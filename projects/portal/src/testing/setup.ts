import { TestBed } from '@angular/core/testing';

/**
 * Dispara efectos (p. ej. las peticiones de `httpResource`), deja que se resuelvan las respuestas ya simuladas y
 * vuelve a renderizar.
 */
export async function settle(): Promise<void> {
  TestBed.tick();
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

export function textOf(element: HTMLElement): string {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
