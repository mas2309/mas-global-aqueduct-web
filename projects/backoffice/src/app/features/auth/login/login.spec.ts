import { ComponentFixture, TestBed } from '@angular/core/testing';
import { authResponse, user } from '../../../../testing/fixtures';
import { click, PageTestContext, setUpPage, textOf, type } from '../../../../testing/setup';
import { AUTH_URL } from '../../../core/auth/auth-api';
import { Login } from './login';

describe('Login', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<Login>;
  let element: HTMLElement;

  beforeEach(async () => {
    context = setUpPage({ session: null });
    fixture = TestBed.createComponent(Login);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => context.http.verify());

  async function submit(email: string, password: string): Promise<void> {
    type(element, 'input[type=email]', email);
    type(element, 'input[formcontrolname=password]', password);
    click(element, 'button[type=submit]');
    await fixture.whenStable();
  }

  it('no envía el formulario incompleto', async () => {
    await submit('no-es-correo', '');

    context.http.expectNone(`${AUTH_URL}/login`);
    expect(textOf(element)).toContain('El correo no es válido');
    expect(textOf(element)).toContain('Ingresa tu contraseña');
  });

  it('ingresa y va a la página de inicio de la sesión', async () => {
    await submit('ana@elhato.co', 'clave-segura-1');

    context.http.expectOne(`${AUTH_URL}/login`).flush(authResponse());
    await fixture.whenStable();

    expect(context.router.navigateByUrl).toHaveBeenCalledWith('/inicio');
  });

  it('vuelve a la página pedida antes del login', async () => {
    fixture.componentRef.setInput('volver', '/prestadores');
    await submit('ana@elhato.co', 'clave-segura-1');
    context.http.expectOne(`${AUTH_URL}/login`).flush(authResponse());

    expect(context.router.navigateByUrl).toHaveBeenCalledWith('/prestadores');
  });

  it('ignora destinos externos (redirección abierta)', async () => {
    fixture.componentRef.setInput('volver', '//sitio-malicioso.com');
    await submit('ana@elhato.co', 'clave-segura-1');
    context.http
      .expectOne(`${AUTH_URL}/login`)
      .flush(authResponse({ user: user({ mustChangePassword: true }) }));

    expect(context.router.navigateByUrl).toHaveBeenCalledWith('/cambiar-clave');
  });

  it('muestra un error claro si las credenciales no son válidas', async () => {
    await submit('ana@elhato.co', 'equivocada');

    context.http
      .expectOne(`${AUTH_URL}/login`)
      .flush(
        { status: 401, detail: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();

    expect(textOf(element)).toContain('Correo o contraseña incorrectos');
  });

  it('avisa cuando la sesión expiró y permite ver la contraseña', async () => {
    fixture.componentRef.setInput('sesion', 'expirada');
    click(element, 'button[aria-label="Mostrar contraseña"]');
    await fixture.whenStable();

    expect(textOf(element)).toContain('Tu sesión expiró');
    expect(element.querySelector('input[formcontrolname=password]')?.getAttribute('type')).toBe(
      'text',
    );
  });
});
