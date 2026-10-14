import { ComponentFixture, TestBed } from '@angular/core/testing';
import { authResponse, user } from '../../../../testing/fixtures';
import { click, PageTestContext, setUpPage, textOf, type } from '../../../../testing/setup';
import { AUTH_URL } from '../../../core/auth/auth-api';
import { ChangePassword, changePasswordError } from './change-password';

describe('ChangePassword', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<ChangePassword>;
  let element: HTMLElement;

  beforeEach(async () => {
    context = setUpPage({ session: authResponse({ user: user({ mustChangePassword: true }) }) });
    fixture = TestBed.createComponent(ChangePassword);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => context.http.verify());

  async function fill(current: string, next: string, confirmation = next): Promise<void> {
    type(element, 'input[formcontrolname=currentPassword]', current);
    type(element, 'input[formcontrolname=newPassword]', next);
    type(element, 'input[formcontrolname=confirmation]', confirmation);
    click(element, 'button[type=submit]');
    await fixture.whenStable();
  }

  it('explica por qué debe cambiarla', () => {
    expect(textOf(element)).toContain('cambia la contraseña que te asignaron');
  });

  it('valida la política antes de enviar', async () => {
    await fill('Temporal-12345', 'corta');
    expect(textOf(element)).toContain('Debe tener al menos 10 caracteres');

    await fill('Temporal-12345', 'Temporal-12345');
    expect(textOf(element)).toContain('debe ser distinta de la actual');

    await fill('Temporal-12345', 'Nueva-clave-2026', 'otra-cosa-2026');
    expect(textOf(element)).toContain('no coinciden');

    await fill('Temporal-12345', 'ana@elhato.co');
    expect(textOf(element)).toContain('no puede ser tu correo');

    context.http.expectNone(`${AUTH_URL}/password`);
  });

  it('cambia la contraseña y continúa con una sesión nueva', async () => {
    await fill('Temporal-12345', 'Nueva-clave-2026');

    context.http.expectOne(`${AUTH_URL}/password`).flush(null);
    context.http.expectOne(`${AUTH_URL}/login`).flush(authResponse());
    await fixture.whenStable();

    expect(context.router.navigateByUrl).toHaveBeenCalledWith('/inicio');
  });

  it('informa si la contraseña actual es incorrecta', async () => {
    await fill('equivocada-123', 'Nueva-clave-2026');

    context.http
      .expectOne(`${AUTH_URL}/password`)
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(textOf(element)).toContain('La contraseña actual es incorrecta');
  });
});

describe('changePasswordError', () => {
  it('traduce el motivo exacto del rechazo de la política', () => {
    expect(
      changePasswordError({
        status: 400,
        detail: 'The new password must be different from the current one',
      }),
    ).toBe('La nueva contraseña debe ser distinta de la actual.');
    expect(changePasswordError({ status: 400, detail: 'password must not be the email' })).toBe(
      'La contraseña no puede ser tu correo.',
    );
    expect(changePasswordError({ status: 400 })).toBe(
      'La nueva contraseña no cumple la política de seguridad.',
    );
  });

  it('muestra el código en errores inesperados para buscarlos en el servidor', () => {
    expect(changePasswordError({ status: 502 })).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo. (código 502)',
    );
    expect(changePasswordError({ status: 429 })).toBe(
      'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    );
  });
});
