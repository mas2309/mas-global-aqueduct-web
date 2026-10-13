import { TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { access, authResponse } from '../../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { subscriber } from '../../../../testing/subscriber-fixtures';
import { Page } from '../../organizations/organization.models';
import { Subscriber } from '../subscriber.models';
import { SUBSCRIBERS_URL } from '../subscribers-api';
import { SubscriberList } from './subscriber-list';

function page(items: Subscriber[], totalItems = items.length): Page<Subscriber> {
  return { items, page: 0, size: 20, totalItems, totalPages: 1 };
}

describe('SubscriberList', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<SubscriberList>;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function open(role: 'OPERATOR' | 'VIEWER' = 'OPERATOR'): Promise<void> {
    context = setUpPage({ session: authResponse({ organization: access({ role }) }) });
    fixture = TestBed.createComponent(SubscriberList);
    element = fixture.nativeElement;
    await settle();
  }

  function expectSearch(query: string | null, pageIndex = 0): TestRequest {
    return context.http.expectOne(
      (request) =>
        request.url === SUBSCRIBERS_URL &&
        request.params.get('q') === query &&
        request.params.get('page') === String(pageIndex),
    );
  }

  it('lista los suscriptores con código, documento y estado', async () => {
    await open();
    expectSearch(null).flush(
      page([
        subscriber(),
        subscriber({
          id: 'x',
          code: 7,
          fullName: 'Pedro Ruiz',
          documentType: null,
          documentNumber: null,
          phone: null,
          status: 'INACTIVE',
        }),
      ]),
    );
    await settle();
    const text = textOf(element);

    expect(text).toContain('000042');
    expect(text).toContain('María Gómez');
    expect(text).toContain('CC 52123456');
    expect(text).toContain('000007');
    expect(text).toContain('Inactivo');
    expect(element.querySelector('a[href="/suscriptores/nuevo"]')).not.toBeNull();
  });

  it('busca al enviar el formulario y vuelve a la primera página', async () => {
    await open();
    expectSearch(null).flush(page([subscriber()], 45));
    await settle();

    type(element, 'input[type=search]', '  gómez ');
    await settle();
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    expectSearch('gómez').flush(page([]));
    await settle();

    expect(textOf(element)).toContain('Ningún suscriptor coincide con «gómez»');

    element.querySelector<HTMLButtonElement>('.state button')!.click();
    await settle();
    expectSearch(null).flush(page([subscriber()]));
  });

  it('descarga para Excel los suscriptores de la búsqueda', async () => {
    await open('VIEWER');
    expectSearch(null).flush(page([subscriber()]));
    await settle();
    const names: string[] = [];
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:file', revokeObjectURL: () => undefined });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    const exportButton = [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => textOf(candidate).includes('Para Excel'),
    );

    exportButton?.click();
    const all = context.http.expectOne((request) => request.url === `${SUBSCRIBERS_URL}/export`);
    expect(all.request.params.has('q')).toBe(false);
    all.flush(new Blob(['csv']));
    expect(names).toEqual(['suscriptores.csv']);

    type(element, 'input[type=search]', 'gómez');
    element.querySelector<HTMLButtonElement>('form.search button[type=submit]')?.click();
    await settle();
    expectSearch('gómez').flush(page([subscriber()]));
    exportButton?.click();
    const filtered = context.http.expectOne(
      (request) => request.url === `${SUBSCRIBERS_URL}/export`,
    );
    expect(filtered.request.params.get('q')).toBe('gómez');
    filtered.flush(new Blob(), { status: 500, statusText: 'Server Error' });
    await settle();
    expect(names).toHaveLength(1);

    vi.unstubAllGlobals();
    anchorClick.mockRestore();
  });

  it('cambia de página', async () => {
    await open();
    expectSearch(null).flush(page([subscriber()], 45));
    await settle();

    element.querySelector<HTMLButtonElement>('button.mat-mdc-paginator-navigation-next')!.click();
    await settle();

    expectSearch(null, 1).flush(page([subscriber()], 45));
  });

  it('el rol de consulta no ve el botón para registrar', async () => {
    await open('VIEWER');
    expectSearch(null).flush(page([]));
    await settle();

    expect(textOf(element)).toContain('Aún no hay suscriptores registrados');
    expect(element.querySelector('a[href="/suscriptores/nuevo"]')).toBeNull();
  });

  it('permite reintentar si falla la carga', async () => {
    await open();
    expectSearch(null).flush(null, { status: 500, statusText: 'Error' });
    await settle();

    expect(textOf(element)).toContain('No pudimos cargar los suscriptores');
    element.querySelector<HTMLButtonElement>('.state button')!.click();
    await settle();
    expectSearch(null).flush(page([]));
  });
});
