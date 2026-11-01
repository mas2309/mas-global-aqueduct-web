import { TestBed } from '@angular/core/testing';
import { access, authResponse, UTILITY_ID, user } from '../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../testing/setup';
import { AUTH_URL } from '../../core/auth/auth-api';
import { REGULATORY_PROFILE_URL } from '../../features/regulatory/regulatory.models';
import { Shell } from './shell';

describe('Shell', () => {
  let context: PageTestContext;

  afterEach(() => {
    answerProfile();
    context.http.verify();
  });

  /** Responde las consultas pendientes del perfil regulatorio; por defecto, sin marco. */
  function answerProfile(framework = 'NONE', reportsToSui = false): void {
    context.http
      .match(REGULATORY_PROFILE_URL)
      .forEach((request) => request.flush({ framework, rules: { reportsToSui } }));
  }

  async function render(framework = 'NONE', reportsToSui = false) {
    const fixture = TestBed.createComponent(Shell);
    await settle();
    answerProfile(framework, reportsToSui);
    await settle();
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
    expect(text).toContain('Documentos');
    expect(text).toContain('Ingresos y gastos');
    expect(text).toContain('Tarifas');
    expect(text).not.toContain('Prestadores');
    expect(text).not.toContain('Usuarios');
  });

  it('sin marco regulatorio el menú queda básico', async () => {
    context = setUpPage({ session: authResponse({ organization: access({ role: 'ORG_ADMIN' }) }) });
    const fixture = await render();
    const menu = textOf(fixture.nativeElement.querySelector('mat-nav-list'));

    expect(menu).not.toContain('Archivos SUI');
    expect(menu).not.toContain('Perfil regulatorio');
    expect(menu).toContain('PQR');
    expect(menu).toContain('Suspensión y corte');

    // El administrador puede activar un marco desde su menú de usuario
    fixture.nativeElement.querySelector('button[aria-label="Opciones de usuario"]').click();
    await settle();
    expect(menuItem('Perfil regulatorio').getAttribute('href')).toBe('/perfil-regulatorio');
  });

  it('un rol sin administración no ve el perfil en su menú de usuario', async () => {
    context = setUpPage();
    const fixture = await render();

    fixture.nativeElement.querySelector('button[aria-label="Opciones de usuario"]').click();
    await settle();
    expect(() => menuItem('Perfil regulatorio')).toThrow();
  });

  it('con marco regulado el menú trae el perfil y los archivos SUI', async () => {
    context = setUpPage();
    const fixture = await render('SMALL_PROVIDERS', true);
    const menu = textOf(fixture.nativeElement.querySelector('mat-nav-list'));

    expect(menu).toContain('Archivos SUI');
    expect(menu).toContain('Perfil regulatorio');
  });

  it('sin marco pero reportando al SUI muestra los archivos', async () => {
    context = setUpPage();
    const fixture = await render('NONE', true);
    const menu = textOf(fixture.nativeElement.querySelector('mat-nav-list'));

    expect(menu).toContain('Archivos SUI');
    expect(menu).not.toContain('Perfil regulatorio');
  });

  it('si el perfil no se puede leer muestra todo el menú', async () => {
    context = setUpPage();
    const fixture = TestBed.createComponent(Shell);
    await settle();
    context.http
      .expectOne(REGULATORY_PROFILE_URL)
      .flush({ status: 500 }, { status: 500, statusText: 'Server Error' });
    await settle();
    const menu = textOf(fixture.nativeElement.querySelector('mat-nav-list'));

    expect(menu).toContain('Archivos SUI');
    expect(menu).toContain('Perfil regulatorio');
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
    await settle();
    menuItem('Acueducto El Hato').click(); // el actual: no hace nada
    fixture.nativeElement.querySelector('.organization-switcher').click();
    await settle();
    menuItem('ESP Sabana').click();

    const request = context.http.expectOne(`${AUTH_URL}/refresh`);
    expect(request.request.body.organizationId).toBe(UTILITY_ID);
    request.flush(authResponse({ organization: utility, organizations: [access(), utility] }));
    await settle();

    // El menú se ajusta al marco del nuevo prestador
    context.http
      .expectOne(REGULATORY_PROFILE_URL)
      .flush({ framework: 'LARGE_PROVIDERS', rules: { reportsToSui: true } });
    await settle();
    expect(textOf(fixture.nativeElement)).toContain('Archivos SUI');

    expect(context.router.navigateByUrl).toHaveBeenCalledWith('/inicio');
    expect(textOf(fixture.nativeElement)).toContain('ESP Sabana');
  });

  it('avisa si el cambio de prestador falla', async () => {
    const utility = access({ organizationId: UTILITY_ID, name: 'ESP Sabana' });
    context = setUpPage({ session: authResponse({ organizations: [access(), utility] }) });
    const fixture = await render();

    fixture.nativeElement.querySelector('.organization-switcher').click();
    await settle();
    menuItem('ESP Sabana').click();
    context.http
      .expectOne(`${AUTH_URL}/refresh`)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(document.body.textContent).toContain('Ya no tienes acceso a este prestador');
  });

  it('cierra sesión desde el menú de usuario', async () => {
    context = setUpPage();
    const fixture = await render();

    fixture.nativeElement.querySelector('button[aria-label="Opciones de usuario"]').click();
    await settle();
    expect(document.body.textContent).toContain('ana@elhato.co');
    menuItem('Cerrar sesión').click();
    context.http.expectOne(`${AUTH_URL}/logout`).flush(null);
    await settle();

    expect(context.store.isAuthenticated()).toBe(false);
    expect(context.router.navigateByUrl).toHaveBeenCalledWith('/ingresar');
  });
});
