import { FormGroup } from '@angular/forms';
import { Problem } from '../../core/api/problem';

/**
 * Marca en cada campo del formulario los errores de validación que devolvió el backend (`errors` del
 * ProblemDetail). Devuelve `true` si asignó alguno.
 */
export function applyServerErrors(form: FormGroup, problem: Problem): boolean {
  let applied = false;
  for (const [field, message] of Object.entries(problem.errors ?? {})) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}
