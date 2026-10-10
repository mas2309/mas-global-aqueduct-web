import { TestBed } from '@angular/core/testing';
import { access, authResponse, user } from '../../../testing/fixtures';
import { setUpPage, textOf } from '../../../testing/setup';
import { Home } from './home';

describe('Home', () => {
  async function render(): Promise<string> {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    return textOf(fixture.nativeElement);
  }

  it('saluda y muestra el prestador y el rol', async () => {
    setUpPage({
      session: authResponse({ organization: access({ inherited: true, role: 'ORG_ADMIN' }) }),
    });
    const text = await render();

    expect(text).toContain('Hola, Ana');
    expect(text).toContain('Tu rol: Administrador');
    expect(text).toContain('acceso por vinculación');
    expect(text).toContain('Próximamente');
    expect(text).not.toContain('Administración de plataforma');
  });

  it('advierte cuando el prestador está suspendido', async () => {
    setUpPage({ session: authResponse({ organization: access({ active: false }) }) });

    expect(await render()).toContain('Este prestador está suspendido');
  });

  it('ofrece la administración al administrador de plataforma', async () => {
    setUpPage({
      session: authResponse({ user: user({ platformAdmin: true }), organization: null }),
    });

    expect(await render()).toContain('Administración de plataforma');
  });
});
