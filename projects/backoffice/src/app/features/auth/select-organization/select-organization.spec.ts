import { TestBed } from '@angular/core/testing';
import { access, authResponse, UTILITY_ID, user } from '../../../../testing/fixtures';
import { PageTestContext, setUpPage, textOf } from '../../../../testing/setup';
import { AUTH_URL } from '../../../core/auth/auth-api';
import { SelectOrganization } from './select-organization';

describe('SelectOrganization', () => {
  let context: PageTestContext;

  afterEach(() => context.http.verify());

  it('lista los prestadores, incluidos los heredados por vinculación', async () => {
    context = setUpPage({
      session: authResponse({
        organization: null,
        organizations: [
          access({ organizationId: UTILITY_ID, name: 'ESP Sabana', role: 'ORG_ADMIN' }),
          access({ inherited: true, role: 'ORG_ADMIN', active: false }),
        ],
      }),
    });
    const fixture = TestBed.createComponent(SelectOrganization);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(textOf(element)).toContain('ESP Sabana');
    expect(textOf(element)).toContain('acceso por vinculación');
    expect(textOf(element)).toContain('suspendido');

    element.querySelectorAll<HTMLButtonElement>('button[mat-list-item]')[0].click();
    const request = context.http.expectOne(`${AUTH_URL}/refresh`);
    expect(request.request.body.organizationId).toBe(UTILITY_ID);
    request.flush(authResponse());
    await fixture.whenStable();

    expect(context.router.navigateByUrl).toHaveBeenCalledWith('/inicio');
  });

  it('avisa si ya no tiene acceso', async () => {
    context = setUpPage({ session: authResponse({ organization: null }) });
    const fixture = TestBed.createComponent(SelectOrganization);
    await fixture.whenStable();

    fixture.nativeElement.querySelector('button[mat-list-item]').click();
    context.http
      .expectOne(`${AUTH_URL}/refresh`)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(context.router.navigateByUrl).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Ya no tienes acceso a este prestador');
  });

  it('orienta al usuario sin prestadores', async () => {
    context = setUpPage({
      session: authResponse({
        organization: null,
        organizations: [],
        user: user({ platformAdmin: true }),
      }),
    });
    const fixture = TestBed.createComponent(SelectOrganization);
    await fixture.whenStable();

    expect(textOf(fixture.nativeElement)).toContain('Aún no tienes acceso a ningún prestador');
    expect(fixture.nativeElement.querySelector('a[href="/prestadores"]')).not.toBeNull();
  });
});
