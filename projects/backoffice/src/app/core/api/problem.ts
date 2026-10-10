import { HttpErrorResponse } from '@angular/common/http';

/** Error de la API en formato RFC 9457 (`application/problem+json`). */
export interface Problem {
  status: number;
  title?: string;
  detail?: string;
  /** Errores de validación por campo (solo en 400). */
  errors?: Record<string, string>;
}

/** Mensajes por estado HTTP. Cada pantalla puede reemplazarlos con uno más preciso para su contexto. */
const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'No hay conexión con el servidor. Verifica tu conexión a internet.',
  400: 'Revisa los datos ingresados.',
  401: 'Tu sesión expiró. Ingresa de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscas.',
  409: 'La operación entra en conflicto con datos existentes.',
  422: 'La operación no es posible en el estado actual.',
  429: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
};

const UNEXPECTED = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

export function toProblem(error: unknown): Problem {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1 };
  }
  const body: unknown = error.error;
  if (body && typeof body === 'object' && 'status' in body) {
    return body as Problem;
  }
  return { status: error.status };
}

/** Mensaje en español para mostrar al usuario. */
export function problemMessage(
  problem: Problem,
  overrides: Partial<Record<number, string>> = {},
): string {
  return overrides[problem.status] ?? DEFAULT_MESSAGES[problem.status] ?? UNEXPECTED;
}
