import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Problem, problemMessage, toProblem } from '../api/problem';

/** Mensajes breves al usuario. Los errores se anuncian también a lectores de pantalla. */
@Injectable({ providedIn: 'root' })
export class Notifier {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 4000, politeness: 'polite' });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 8000, politeness: 'assertive' });
  }

  /** Muestra el error de una llamada a la API con un mensaje en español según su estado. */
  apiError(error: unknown, overrides: Partial<Record<number, string>> = {}): Problem {
    const problem = toProblem(error);
    this.error(problemMessage(problem, overrides));
    return problem;
  }
}
