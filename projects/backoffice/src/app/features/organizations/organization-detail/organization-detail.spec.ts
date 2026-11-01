import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AQUEDUCT_ID, organization, UTILITY_ID } from '../../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { Member } from '../../members/member.models';
import { membersUrl } from '../../members/members-api';
import { Affiliation, Organization, Page } from '../organization.models';
import { AFFILIATIONS_URL, ORGANIZATIONS_URL } from '../organizations-api';
import { OrganizationDetail } from './organization-detail';

const OTHER_ID = '33333333-3333-3333-3333-333333333333';

const utility = organization({
  id: UTILITY_ID,
  tradeName: 'ESP Sabana',
  type: 'PUBLIC_UTILITY_COMPANY',
  services: ['WATER', 'SEWERAGE'],
});
const affiliation: Affiliation = {
  id: 'aff-1',
  parentOrganizationId: UTILITY_ID,
  childOrganizationId: AQUEDUCT_ID,
  status: 'ACTIVE',
  startedAt: '2026-10-01T00:00:00Z',
  endedAt: null,
};

function catalog(items: Organization[]): Page<Organization> {
  return { items, page: 0, size: 100, totalItems: items.length, totalPages: 1 };
}

describe('OrganizationDetail', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<OrganizationDetail>;
  let element: HTMLElement;
  let confirmed: boolean;

  beforeEach(() => {
    confirmed = true;
    context = setUpPage({
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirmed) }) } },
      ],
    });
  });

  afterEach(() => context.http.verify());

  async function open(org: Organization, members: Member[] = []): Promise<void> {
    fixture = TestBed.createComponent(OrganizationDetail);
    fixture.componentRef.setInput('id', org.id);
    element = fixture.nativeElement;
    await settle();
    context.http.expectOne(`${ORGANIZATIONS_URL}/${org.id}`).flush(org);
    await settle();
    context.http.expectOne(membersUrl(org.id)).flush(members);
    context.http
      .expectOne(`${ORGANIZATIONS_URL}/${org.id}/regulatory-profile`)
      .flush({ framework: 'NONE', census: null, classification: null });
    await settle();
  }

  it('crea el administrador de un prestador nuevo sin operar como él', async () => {
    const dialog = TestBed.inject(MatDialog);
    const openDialog = vi
      .spyOn(dialog, 'open')
      .mockReturnValue({ afterClosed: () => of(undefined) } as never);
    await open(organization());

    expect(textOf(element)).toContain('Agrega su administrador');
    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => textOf(button).includes('Agregar administrador'))!
      .click();

    expect(openDialog).toHaveBeenCalledWith(expect.anything(), {
      data: {
        organizationId: AQUEDUCT_ID,
        organizationName: 'Acueducto El Hato',
        role: 'ORG_ADMIN',
      },
    });
  });

  async function loadAffiliationData(
    affiliations: Affiliation[],
    items: Organization[],
  ): Promise<void> {
    context.http
      .expectOne((request) => request.url === AFFILIATIONS_URL && request.method === 'GET')
      .flush(affiliations);
    context.http
      .expectOne(
        (request) => request.url === ORGANIZATIONS_URL && request.params.get('size') === '100',
      )
      .flush(catalog(items));
    await settle();
  }

  it('muestra los datos de un acueducto sin sección de vinculados', async () => {
    await open(organization({ email: 'admin@elhato.co' }));

    const text = textOf(element);
    expect(text).toContain('Acueducto El Hato');
    expect(text).toContain('NIT 900123456-8');
    expect(text).toContain('admin@elhato.co');
    expect(text).not.toContain('Prestadores vinculados');
  });

  it('no deja retirar el único servicio y habilita otros', async () => {
    await open(organization());
    const toggles = element.querySelectorAll<HTMLButtonElement>('mat-slide-toggle button');
    expect(toggles[0].disabled).toBe(true);

    toggles[2].click();
    await settle();
    const request = context.http.expectOne(
      `${ORGANIZATIONS_URL}/${AQUEDUCT_ID}/services/SANITATION`,
    );
    expect(request.request.method).toBe('PUT');
    request.flush(organization({ services: ['WATER', 'SANITATION'] }));
    await settle();

    expect(element.querySelectorAll<HTMLButtonElement>('mat-slide-toggle button')[0].disabled).toBe(
      false,
    );
  });

  it('suspende el prestador tras confirmar', async () => {
    await open(organization());

    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => textOf(button) === 'Suspender')!
      .click();
    context.http
      .expectOne(`${ORGANIZATIONS_URL}/${AQUEDUCT_ID}/suspend`)
      .flush(organization({ status: 'SUSPENDED' }));
    await settle();

    expect(textOf(element)).toContain('Reactivar');
  });

  it('no hace nada si el usuario cancela la confirmación', async () => {
    confirmed = false;
    await open(organization());

    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => textOf(button) === 'Suspender')!
      .click();
    await settle();

    context.http.expectNone(`${ORGANIZATIONS_URL}/${AQUEDUCT_ID}/suspend`);
  });

  it('lista los vinculados de una ESP, vincula uno nuevo y termina otro', async () => {
    const other = organization({ id: OTHER_ID, tradeName: 'Acueducto La Paz', nit: '901000001-6' });
    await open(utility);
    await loadAffiliationData([affiliation], [utility, organization(), other]);

    expect(textOf(element)).toContain('Prestadores vinculados');
    expect(textOf(element)).toContain('Acueducto El Hato');

    // Solo se ofrece el que no está vinculado ni es la misma ESP
    const component = fixture.componentInstance as unknown as {
      candidates: () => Organization[];
      selectedChild: { set: (id: string) => void };
      affiliate: () => void;
    };
    expect(component.candidates().map((candidate) => candidate.id)).toEqual([OTHER_ID]);

    component.selectedChild.set(OTHER_ID);
    component.affiliate();
    const create = context.http.expectOne(
      (request) => request.url === AFFILIATIONS_URL && request.method === 'POST',
    );
    expect(create.request.body).toEqual({
      parentOrganizationId: UTILITY_ID,
      childOrganizationId: OTHER_ID,
    });
    create.flush({ ...affiliation, id: 'aff-2', childOrganizationId: OTHER_ID });
    await settle();
    context.http
      .expectOne((request) => request.url === AFFILIATIONS_URL && request.method === 'GET')
      .flush([affiliation]);
    await settle();

    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => textOf(button) === 'Terminar')!
      .click();
    context.http
      .expectOne(`${AFFILIATIONS_URL}/aff-1/end`)
      .flush({ ...affiliation, status: 'ENDED' });
    await settle();
    context.http
      .expectOne((request) => request.url === AFFILIATIONS_URL && request.method === 'GET')
      .flush([]);
    await settle();

    expect(textOf(element)).toContain('Aún no tiene prestadores vinculados');
  });

  it('explica por qué no se pudo vincular', async () => {
    await open(utility);
    await loadAffiliationData([], [utility, organization()]);
    const component = fixture.componentInstance as unknown as {
      selectedChild: { set: (id: string) => void };
      affiliate: () => void;
    };

    component.selectedChild.set(AQUEDUCT_ID);
    component.affiliate();
    context.http
      .expectOne((request) => request.url === AFFILIATIONS_URL && request.method === 'POST')
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();

    expect(document.body.textContent).toContain('ya está vinculado a otra empresa');
  });

  it('no ofrece operar como el prestador: el administrador global solo lo configura', async () => {
    await open(organization());

    expect(textOf(element)).not.toContain('Operar como');
  });

  it('informa si el prestador no existe', async () => {
    fixture = TestBed.createComponent(OrganizationDetail);
    fixture.componentRef.setInput('id', 'no-existe');
    await settle();
    context.http
      .expectOne(`${ORGANIZATIONS_URL}/no-existe`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(textOf(fixture.nativeElement)).toContain('No encontramos este prestador');
  });
});
