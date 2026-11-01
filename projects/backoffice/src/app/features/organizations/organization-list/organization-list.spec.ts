import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { organization, UTILITY_ID } from '../../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { Organization, Page } from '../organization.models';
import { ORGANIZATIONS_URL } from '../organizations-api';
import { OrganizationList } from './organization-list';

function page(items: Organization[], totalItems = items.length): Page<Organization> {
  return { items, page: 0, size: 20, totalItems, totalPages: 1 };
}

describe('OrganizationList', () => {
  let context: PageTestContext;

  beforeEach(() => {
    context = setUpPage();
  });

  afterEach(() => context.http.verify());

  function expectList(pageIndex: number, size: number): TestRequest {
    return context.http.expectOne(
      (request) =>
        request.url === ORGANIZATIONS_URL &&
        request.params.get('page') === String(pageIndex) &&
        request.params.get('size') === String(size),
    );
  }

  it('muestra los prestadores con tipo, servicios y estado', async () => {
    const fixture = TestBed.createComponent(OrganizationList);
    await settle();

    expectList(0, 20).flush(
      page([
        organization({ services: ['WATER', 'SANITATION'] }),
        organization({
          id: UTILITY_ID,
          tradeName: null,
          legalName: 'ESP Sabana S.A. E.S.P.',
          type: 'PUBLIC_UTILITY_COMPANY',
          status: 'SUSPENDED',
        }),
      ]),
    );
    await settle();
    const text = textOf(fixture.nativeElement);

    expect(text).toContain('Acueducto El Hato');
    expect(text).toContain('Asociación de Usuarios Acueducto El Hato');
    expect(text).toContain('ESP Sabana S.A. E.S.P.');
    expect(text).toContain('Empresa de servicios públicos');
    expect(text).toContain('Suspendido');
    expect(fixture.nativeElement.querySelector('mat-icon[aria-label="Aseo"]')).not.toBeNull();
  });

  it('cada fila lleva a editar y permite suspender tras confirmar', async () => {
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as never);
    const fixture = TestBed.createComponent(OrganizationList);
    await settle();
    const active = organization();
    expectList(0, 20).flush(page([active]));
    await settle();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('a[aria-label^="Editar"]')?.getAttribute('href')).toBe(
      `/prestadores/${active.id}/editar`,
    );
    element.querySelector<HTMLElement>('button[aria-label^="Suspender"]')?.click();
    await settle();

    const request = context.http.expectOne(`${ORGANIZATIONS_URL}/${active.id}/suspend`);
    expect(request.request.method).toBe('POST');
    request.flush({ ...active, status: 'SUSPENDED' });
    await settle();
    expectList(0, 20).flush(page([{ ...active, status: 'SUSPENDED' }]));
    await settle();

    expect(textOf(element)).toContain('Suspendido');
    expect(element.querySelector('button[aria-label^="Reactivar"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Prestador suspendido');
  });

  it('cambia de página consultando de nuevo', async () => {
    const fixture = TestBed.createComponent(OrganizationList);
    await settle();
    expectList(0, 20).flush(page([organization()], 45));
    await settle();

    fixture.nativeElement.querySelector('button.mat-mdc-paginator-navigation-next').click();
    await settle();

    expectList(1, 20).flush(page([organization()], 45));
  });

  it('invita a vincular el primero si no hay ninguno', async () => {
    const fixture = TestBed.createComponent(OrganizationList);
    await settle();
    expectList(0, 20).flush(page([]));
    await settle();

    expect(textOf(fixture.nativeElement)).toContain('Aún no hay prestadores vinculados');
  });

  it('permite reintentar si falla la carga', async () => {
    const fixture = TestBed.createComponent(OrganizationList);
    await settle();
    expectList(0, 20).flush(null, { status: 500, statusText: 'Error' });
    await settle();

    expect(textOf(fixture.nativeElement)).toContain('No pudimos cargar los prestadores');
    fixture.nativeElement.querySelector('.state button').click();
    await settle();
    expectList(0, 20).flush(page([organization()]));
  });
});
