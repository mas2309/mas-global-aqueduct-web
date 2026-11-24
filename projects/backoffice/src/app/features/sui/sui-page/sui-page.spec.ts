import { TestBed } from '@angular/core/testing';
import { access, authResponse } from '../../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { SUI_URL, SuiFormat, SuiReview, SuiTemplate } from '../sui.models';
import { SuiPage } from './sui-page';

function template(format: SuiFormat = 'USER_CATALOG', version = 0): SuiTemplate {
  return {
    format,
    version,
    columns: [
      { header: 'ID_SUSCRIPTOR', field: 'PROPERTY_CODE', service: null },
      { header: 'ESTADO', field: 'STATUS_CODE', service: 'WATER' },
    ],
    codes: { 'status.ACTIVE': '1' },
  };
}

describe('SuiPage', () => {
  let context: PageTestContext;

  afterEach(() => context.http.verify());

  async function open(
    review: SuiReview | null,
    role: 'ORG_ADMIN' | 'OPERATOR' | 'VIEWER' = 'ORG_ADMIN',
  ) {
    context = setUpPage({ session: authResponse({ organization: access({ role }) }) });
    const fixture = TestBed.createComponent(SuiPage);
    await settle();
    context.http.expectOne(`${SUI_URL}/USER_CATALOG/template`).flush(template());
    if (review) {
      context.http.expectOne(`${SUI_URL}/USER_CATALOG/review`).flush(review);
    }
    await settle();
    return fixture;
  }

  function exportButton(element: HTMLElement): HTMLButtonElement | undefined {
    return [...element.querySelectorAll('button')].find((button) =>
      textOf(button).includes('Exportar CSV'),
    );
  }

  it('advierte que el catastro es un borrador sin validar', async () => {
    const fixture = await open({ rows: 0, issues: [] });
    expect(textOf(fixture.nativeElement)).toContain('Borrador sin validar');
  });

  it('con datos por corregir los lista y no deja exportar', async () => {
    const fixture = await open({
      rows: 2,
      issues: [{ propertyCode: 7, column: 'ESTRATO', message: 'El dato es obligatorio' }],
    });
    const element: HTMLElement = fixture.nativeElement;

    expect(textOf(element)).toContain('2 filas · 1 por corregir');
    expect(textOf(element)).toContain('El dato es obligatorio');
    expect(exportButton(element)?.disabled).toBe(true);
  });

  it('sin problemas exporta el CSV', async () => {
    const fixture = await open({ rows: 1, issues: [] });
    const element: HTMLElement = fixture.nativeElement;
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    expect(exportButton(element)?.disabled).toBe(false);
    exportButton(element)?.click();
    context.http
      .expectOne((request) => request.url === `${SUI_URL}/USER_CATALOG/export`)
      .flush(new Blob(['a,b']));
    await settle();

    expect(createUrl).toHaveBeenCalled();
    createUrl.mockRestore();
    revoke.mockRestore();
    anchorClick.mockRestore();
  });

  it('el administrador guarda la plantilla como una versión nueva', async () => {
    const fixture = await open({ rows: 0, issues: [] });
    const page = fixture.componentInstance;

    page['updateColumn'](0, { header: 'CUENTA' });
    page['updateCode'](0, { value: 'A' });
    page['save']();
    const request = context.http.expectOne(`${SUI_URL}/USER_CATALOG/template`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      columns: [
        { header: 'CUENTA', field: 'PROPERTY_CODE', service: null },
        { header: 'ESTADO', field: 'STATUS_CODE', service: 'WATER' },
      ],
      codes: { 'status.ACTIVE': 'A' },
    });
    request.flush(template('USER_CATALOG', 1));
    await settle();
    context.http.expectOne(`${SUI_URL}/USER_CATALOG/review`).flush({ rows: 0, issues: [] });
    await settle();

    expect(textOf(fixture.nativeElement)).toContain('Versión 1 de este prestador');
  });

  it('no deja guardar encabezados que romperían el archivo', async () => {
    const fixture = await open({ rows: 0, issues: [] });
    const page = fixture.componentInstance;

    page['updateColumn'](0, { header: 'A,B' });
    expect(page['valid']()).toBe(false);
    page['updateColumn'](0, { header: 'ESTADO' });
    expect(page['valid']()).toBe(false);
    page['updateColumn'](0, { header: 'CUENTA' });
    page['addCode']();
    expect(page['valid']()).toBe(false);
    page['removeCode'](1);
    expect(page['valid']()).toBe(true);

    page['updateColumn'](1, { header: 'A|B' });
    page['save']();
    context.http.expectNone(`${SUI_URL}/USER_CATALOG/template`);
  });

  it('agrega, sube y quita columnas', async () => {
    const fixture = await open({ rows: 0, issues: [] });
    const page = fixture.componentInstance;

    page['addColumn']();
    expect(page['columns']().length).toBe(3);
    page['moveUp'](1);
    expect(page['columns']()[0].header).toBe('ESTADO');
    page['removeColumn'](2);
    expect(page['columns']().length).toBe(2);
  });

  it('un rol de consulta solo ve la plantilla', async () => {
    const fixture = await open(null, 'VIEWER');
    const element: HTMLElement = fixture.nativeElement;

    expect(textOf(element)).toContain('ID_SUSCRIPTOR');
    expect(exportButton(element)).toBeUndefined();
    expect(textOf(element)).not.toContain('Guardar como nueva versión');
  });

  it('un operador revisa y exporta, pero no cambia la plantilla', async () => {
    const fixture = await open({ rows: 1, issues: [] }, 'OPERATOR');
    const element: HTMLElement = fixture.nativeElement;

    expect(exportButton(element)).toBeDefined();
    expect(textOf(element)).not.toContain('Guardar como nueva versión');
  });

  it('al cambiar de archivo consulta su plantilla y su revisión', async () => {
    const fixture = await open({ rows: 0, issues: [] });

    fixture.componentInstance['format'].set('REC_PROVIDER');
    await settle();
    context.http.expectOne(`${SUI_URL}/REC_PROVIDER/template`).flush(template('REC_PROVIDER'));
    context.http.expectOne(`${SUI_URL}/REC_PROVIDER/review`).flush({ rows: 0, issues: [] });
    await settle();

    expect(textOf(fixture.nativeElement)).toContain('instructivo de la SSPD');
  });
});
