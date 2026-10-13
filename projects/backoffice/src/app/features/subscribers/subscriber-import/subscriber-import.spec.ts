import { TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { ImportResult } from '../subscriber.models';
import { IMPORT_URL, SubscriberImport } from './subscriber-import';

describe('SubscriberImport', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<SubscriberImport>;
  let element: HTMLElement;
  const csv = new File(['nombre;direccion\nMaría;Calle 1\n'], 'suscriptores.csv', {
    type: 'text/csv',
  });

  beforeEach(async () => {
    context = setUpPage();
    fixture = TestBed.createComponent(SubscriberImport);
    element = fixture.nativeElement;
    await settle();
  });

  afterEach(() => {
    context.http.verify();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function choose(file: File | null): void {
    const input = element.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  function expectUpload(validateOnly: boolean): TestRequest {
    const request = context.http.expectOne(
      (candidate) =>
        candidate.url === IMPORT_URL &&
        candidate.params.get('validateOnly') === String(validateOnly),
    );
    expect((request.request.body as FormData).get('file')).toBe(csv);
    return request;
  }

  async function review(result: ImportResult): Promise<void> {
    choose(csv);
    expectUpload(true).flush(result);
    await settle();
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      textOf(candidate).includes(label),
    );
  }

  it('revisa el archivo al elegirlo y lo importa si está bien', async () => {
    await review({ rows: 120, imported: 0, errors: [] });
    expect(textOf(element)).toContain('suscriptores.csv está bien: 120 suscriptores para importar');

    button('Importar')?.click();
    expectUpload(false).flush({ rows: 120, imported: 120, errors: [] });
    await settle();

    expect(textOf(element)).toContain('Se importaron 120 suscriptores');
    expect(document.body.textContent).toContain('120 suscriptores importados');
    expect(element.querySelector('a[href="/suscriptores"]')).not.toBeNull();
  });

  it('lista los errores y no deja importar', async () => {
    await review({
      rows: 3,
      imported: 0,
      errors: [
        { line: 3, message: 'Falta «direccion»' },
        { line: 4, message: 'Falta el estrato: es obligatorio en predios residenciales' },
      ],
    });
    const text = textOf(element);

    expect(text).toContain('suscriptores.csv tiene errores: no se importó nada');
    expect(text).toContain('Falta «direccion»');
    expect(text).toContain('Falta el estrato');
    expect(button('Importar')).toBeUndefined();
  });

  it('un archivo de una fila se anuncia en singular y uno vacío no se importa', async () => {
    await review({ rows: 1, imported: 0, errors: [] });
    expect(textOf(element)).toContain('1 suscriptor para importar');

    await review({ rows: 0, imported: 0, errors: [] });
    expect(button('Importar')?.disabled).toBe(true);

    choose(null);
    await settle();
    expect(textOf(element)).not.toContain('para importar');
  });

  it('explica cuando el archivo no se puede leer o el rol no alcanza', async () => {
    choose(csv);
    expectUpload(true).flush({ status: 400 }, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(document.body.textContent).toContain('No pudimos leer el archivo');

    choose(csv);
    expectUpload(true).flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(document.body.textContent).toContain('Solo el administrador del prestador importa');
  });

  it('descarga la plantilla', async () => {
    const names: string[] = [];
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:file', revokeObjectURL: () => undefined });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    button('Descargar plantilla')?.click();
    context.http.expectOne(`${IMPORT_URL}/template`).flush(new Blob(['csv']));
    button('Descargar plantilla')?.click();
    context.http
      .expectOne(`${IMPORT_URL}/template`)
      .flush(new Blob(), { status: 500, statusText: 'Server Error' });
    await settle();

    expect(names).toEqual(['plantilla-suscriptores.csv']);
  });
});
