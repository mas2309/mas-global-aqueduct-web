import { TestBed } from '@angular/core/testing';
import { access, authResponse, UTILITY_ID, user } from '../../../testing/fixtures';
import { PageTestContext, setUpPage, textOf } from '../../../testing/setup';
import { AUTH_URL } from '../../core/auth/auth-api';
import { Shell } from './shell';

describe('Shell', () => {
  let context: PageTestContext;

  afterEach(() => context.http.verify());

  async function render() {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    return fixture;
  }

  function menuItem(text: string): HTMLElement {
    const item = [...document.querySelectorAll<HTMLElement>('[mat-menu-item]')].find((element) =>
      textOf(element).includes(text),
    );
    if (!item) {
      throw new Error(`Menu item not found: ${text}`);
    }
    return item;
  }

  it('muestra el prestador actual y el menú según el rol', async () => {
    context = setUpPage();
    const fixture = await render();
    const text = textOf(fixture.nativeElement);

    expect(text).toContain('Acueducto El Hato');
    expect(text).toContain('Inicio');
    expect(text).toContain('Lecturas');
    expect(text).toContain('Facturas');
    expect(text).toContain('Financiaciones');
    expect(text).toContain('Informes');
    expect(text).toContain('Tarifas');
    expect(text).not.toContain('Prestadores');
    expect(text).not.toContain('Usuarios');
  });

  it('el administrador del prestador ve la gestión de usuarios', async () => {
    context = setUpPage({ session: authResponse({ organization: access({ role: 'ORG_ADMIN' }) }) });
    const fixture = await render();

    expect(textOf(fixture.nativeElement)).toContain('Usuarios');
  });

  it('el administrador de plataforma ve la administración de prestadores', async () => {
    context = setUpPage({
      session: authResponse({
        user: user({ platformAdmin: true }),
        organization: null,
        organizations: [],
      }),
    });
    const fixture = await render();

    expect(textOf(fixture.nativeElement)).toContain('Prestadores');
    expect(textOf(fixture.nativeElement)).not.toContain('Seleccionar prestador');
  });

  it('cambia de prestador desde la barra superior', async () => {
    const utility = access({ organizationId: UTILITY_ID, name: 'ESP Sabana', role: 'ORG_ADMIN' });
    context = setUpPage({ session: authResponse({ organizations: [access(), utility] }) });
    const fixture = await render();

    fixture.nativeElement.querySelector('.organization-switcher').click();
    await fixture.whenStable();
    menuItem('Acueducto El Hato').click(); // el actual: no hace nada
    fixture.nativeElement.querySelector('.organization-switcher').click();
    await fixture.whenStable();
    menuItem('ESP Sabana').click();

    const request = context.http.expectOne(`${AUTH_URL}/refresh`);
    expect(request.request.body.organizationId).toBe(UTILITY_ID);
    request.flush(authResponse({ organization: utility, organizations: [access(), utility] }));
    await fixture.whenStable();

    expect(context.router.navigateByUrl).toHaveBeenCalledWith('/inicio');
    expect(textOf(fixture.nativeElement)).toContain('ESP Sabana');
  });

  it('avisa si el cambio de prestador falla', async () => {
    const utility = access({ organizationId: UTILITY_ID, name: 'ESP Sabana' });
    context = setUpPage({ session: authResponse({ organizations: [access(), utility] }) });
    const fixture = await render();

    fixture.nativeElement.querySelector('.organization-switcher').click();
    await fixture.whenStable();
    menuItem('ESP Sabana').click();
    context.http
      .expectOne(`${AUTH_URL}/refresh`)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Ya no tienes acceso a este prestador');
  });

  it('cierra sesión desde el menú de usuario', async () => {
    context = setUpPage();
    const fixture = await render();

    fixture.nativeElement.querySelector('button[aria-label="Opciones de usuario"]').click();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('ana@elhato.co');
    menuItem('Cerrar sesión').click();
    context.http.expectOne(`${AUTH_URL}/logout`).flush(null);
    await fixture.whenStable();

    expect(context.store.isAuthenticated()).toBe(false);
    expect(context.router.navigateByUrl).toHaveBeenCalledWith('/ingresar');
  });
});
