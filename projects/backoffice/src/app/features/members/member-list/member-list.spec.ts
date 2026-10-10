import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { access, AQUEDUCT_ID, authResponse, user } from '../../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { Member } from '../member.models';
import { membersUrl } from '../members-api';
import { MemberList } from './member-list';

const URL = membersUrl(AQUEDUCT_ID);

function member(overrides: Partial<Member> = {}): Member {
  return {
    userId: 'u-1',
    email: 'luis@elhato.co',
    fullName: 'Luis Gómez',
    role: 'OPERATOR',
    userStatus: 'ACTIVE',
    memberSince: '2026-10-01T00:00:00Z',
    accountCreated: false,
    ...overrides,
  };
}

describe('MemberList', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<MemberList>;
  let element: HTMLElement;
  /** Lo que devuelve el diálogo abierto (confirmación o miembro agregado). */
  let dialogResult: unknown;
  let component: {
    changeRole: (member: Member, role: OrganizationRole) => void;
  };

  beforeEach(() => {
    dialogResult = true;
    context = setUpPage({
      session: authResponse({
        user: user({ id: 'me' }),
        organization: access({ role: 'ORG_ADMIN' }),
      }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
  });

  afterEach(() => context.http.verify());

  async function open(members: Member[]): Promise<void> {
    fixture = TestBed.createComponent(MemberList);
    element = fixture.nativeElement;
    component = fixture.componentInstance as unknown as typeof component;
    await settle();
    context.http.expectOne(URL).flush(members);
    await settle();
  }

  it('lista los usuarios con su rol y marca al usuario actual', async () => {
    await open([
      member(),
      member({ userId: 'me', fullName: 'Ana Pérez', email: 'ana@elhato.co', role: 'ORG_ADMIN' }),
      member({ userId: 'u-3', fullName: 'Zoe Ruiz', userStatus: 'DISABLED' }),
    ]);
    const text = textOf(element);

    expect(text).toContain('Quién puede entrar a Acueducto El Hato');
    expect(text).toContain('Luis Gómez');
    expect(text).toContain('luis@elhato.co');
    expect(text).toContain('Ana Pérez (tú)');
    expect(text).toContain('Cuenta deshabilitada');
  });

  it('explica el estado vacío', async () => {
    await open([]);

    expect(textOf(element)).toContain('aún no tiene usuarios propios');
  });

  it('recarga la lista cuando se agrega un usuario', async () => {
    await open([]);
    dialogResult = member({ fullName: 'Nuevo Lector' });

    element.querySelector<HTMLButtonElement>('.page-header button')!.click();
    await settle();

    context.http.expectOne(URL).flush([member({ fullName: 'Nuevo Lector' })]);
    await settle();
    expect(document.body.textContent).toContain('Nuevo Lector ahora tiene acceso');
  });

  it('no recarga si se cancela el diálogo', async () => {
    await open([]);
    dialogResult = undefined;

    element.querySelector<HTMLButtonElement>('.page-header button')!.click();
    await settle();

    context.http.expectNone(URL);
  });

  it('cambia el rol de un usuario', async () => {
    const luis = member();
    await open([luis]);

    component.changeRole(luis, 'OPERATOR'); // mismo rol: no hace nada
    component.changeRole(luis, 'ORG_ADMIN');
    const request = context.http.expectOne((r) => r.url === URL && r.method === 'POST');
    expect(request.request.body).toEqual({ email: 'luis@elhato.co', role: 'ORG_ADMIN' });
    request.flush(member({ role: 'ORG_ADMIN' }));
    await settle();

    context.http.expectOne(URL).flush([member({ role: 'ORG_ADMIN' })]);
    await settle();
    expect(document.body.textContent).toContain('Luis Gómez ahora es Administrador');
  });

  it('no deja al prestador sin administrador', async () => {
    const admin = member({ role: 'ORG_ADMIN' });
    await open([admin]);

    component.changeRole(admin, 'VIEWER');
    context.http
      .expectOne((r) => r.url === URL && r.method === 'POST')
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();
    context.http.expectOne(URL).flush([admin]);
    await settle();

    expect(document.body.textContent).toContain('debe conservar al menos un administrador');
  });

  it('quita el acceso tras confirmar', async () => {
    await open([member()]);

    element
      .querySelector<HTMLButtonElement>('button[aria-label="Quitar acceso a Luis Gómez"]')!
      .click();
    const request = context.http.expectOne(`${URL}/u-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await settle();

    context.http.expectOne(URL).flush([]);
    await settle();
    expect(document.body.textContent).toContain('Se quitó el acceso de Luis Gómez');
  });

  it('no quita el acceso si se cancela', async () => {
    await open([member()]);
    dialogResult = false;

    element
      .querySelector<HTMLButtonElement>('button[aria-label="Quitar acceso a Luis Gómez"]')!
      .click();
    await settle();

    context.http.expectNone(`${URL}/u-1`);
  });

  it('permite reintentar si falla la carga', async () => {
    fixture = TestBed.createComponent(MemberList);
    await settle();
    context.http.expectOne(URL).flush(null, { status: 500, statusText: 'Error' });
    await settle();

    expect(textOf(fixture.nativeElement)).toContain('No pudimos cargar los usuarios');
    fixture.nativeElement.querySelector('.state button').click();
    await settle();
    context.http.expectOne(URL).flush([]);
  });
});
