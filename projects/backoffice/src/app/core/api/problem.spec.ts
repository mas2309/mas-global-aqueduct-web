import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup } from '@angular/forms';
import { applyServerErrors } from '../../shared/forms/server-errors';
import { problemMessage, toProblem } from './problem';

describe('Problem', () => {
  it('lee el cuerpo RFC 9457 del backend', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { status: 400, title: 'Bad Request', errors: { nit: 'must not be blank' } },
    });

    expect(toProblem(error)).toEqual({
      status: 400,
      title: 'Bad Request',
      errors: { nit: 'must not be blank' },
    });
  });

  it('usa solo el estado si no hay cuerpo, y -1 si no es un error HTTP', () => {
    expect(toProblem(new HttpErrorResponse({ status: 0 }))).toEqual({ status: 0 });
    expect(toProblem(new Error('x'))).toEqual({ status: -1 });
  });

  it('traduce el estado a un mensaje en español, con reemplazos por pantalla', () => {
    expect(problemMessage({ status: 403 })).toContain('No tienes permiso');
    expect(problemMessage({ status: 0 })).toContain('conexión');
    expect(problemMessage({ status: 500 })).toContain('error inesperado');
    expect(problemMessage({ status: 409 }, { 409: 'NIT repetido' })).toBe('NIT repetido');
  });

  it('marca los errores del servidor en los campos del formulario', () => {
    const form = new FormGroup({ nit: new FormControl('x'), name: new FormControl('y') });

    const applied = applyServerErrors(form, {
      status: 400,
      errors: { nit: 'invalid', unknown: 'ignored' },
    });

    expect(applied).toBe(true);
    expect(form.controls.nit.getError('server')).toBe('invalid');
    expect(form.controls.nit.touched).toBe(true);
    expect(applyServerErrors(form, { status: 409 })).toBe(false);
  });
});
