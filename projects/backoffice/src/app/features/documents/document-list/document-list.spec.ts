import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { access, authResponse } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { DocumentDialog } from '../document-dialog/document-dialog';
import { DOCUMENTS_URL, StoredDocument } from '../document.models';
import { DocumentList } from './document-list';

const DOCUMENT_ID = '55555555-5555-5555-5555-555555555555';

function storedDocument(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    id: DOCUMENT_ID,
    title: 'Estatutos',
    description: 'Aprobados en 2020',
    fileName: 'estatutos.pdf',
    contentType: 'application/pdf',
    size: 327680,
    createdAt: '2026-10-01T15:00:00Z',
    ...overrides,
  };
}

describe('DocumentList', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<DocumentList>;
  let element: HTMLElement;
  let dialogResult: unknown;

  afterEach(() => {
    context.http.verify();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function open(
    documents: StoredDocument[] | null,
    role: OrganizationRole = 'OPERATOR',
  ): Promise<void> {
    dialogResult = true;
    context = setUpPage({
      session: authResponse({ organization: access({ role }) }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(DocumentList);
    element = fixture.nativeElement;
    await settle();
    await load(documents);
  }

  async function load(documents: StoredDocument[] | null): Promise<void> {
    const request = context.http.expectOne(DOCUMENTS_URL);
    if (documents) {
      request.flush(documents);
    } else {
      request.flush(null, { status: 500, statusText: 'Server Error' });
    }
    await settle();
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      textOf(candidate).includes(label),
    );
  }

  it('lista los documentos con su archivo y tamaño', async () => {
    await open([
      storedDocument(),
      storedDocument({
        id: 'photo',
        title: 'Foto del tanque',
        description: null,
        fileName: 'tanque.png',
        contentType: 'image/png',
        size: 1500000,
      }),
    ]);
    const text = textOf(element);

    expect(text).toContain('Estatutos');
    expect(text).toContain('Aprobados en 2020');
    expect(text).toContain('estatutos.pdf · 320 kB');
    expect(text).toContain('Foto del tanque');
    expect(text).toContain('tanque.png · 1,4 MB');
  });

  it('sube un documento desde el diálogo', async () => {
    await open([]);
    expect(textOf(element)).toContain('Aún no hay documentos');

    dialogResult = undefined;
    button('Subir documento')?.click();
    context.http.expectNone(DOCUMENTS_URL);

    dialogResult = storedDocument();
    button('Subir documento')?.click();
    await settle();
    await load([storedDocument()]);
    expect(document.body.textContent).toContain('Documento guardado');
  });

  it('descarga el archivo con su nombre', async () => {
    await open([storedDocument()], 'VIEWER');
    const names: string[] = [];
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:file', revokeObjectURL: () => undefined });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    // El rol de consulta descarga, pero no sube ni elimina
    expect(button('Subir documento')).toBeUndefined();
    expect(element.querySelector('button[aria-label^="Eliminar"]')).toBeNull();

    button('Descargar')?.click();
    context.http.expectOne(`${DOCUMENTS_URL}/${DOCUMENT_ID}/file`).flush(new Blob(['pdf']));
    button('Descargar')?.click();
    context.http
      .expectOne(`${DOCUMENTS_URL}/${DOCUMENT_ID}/file`)
      .flush(new Blob(), { status: 404, statusText: 'Not Found' });
    await settle();

    expect(names).toEqual(['estatutos.pdf']);
  });

  it('elimina solo si se confirma y avisa si el servidor lo rechaza', async () => {
    await open([storedDocument()]);

    dialogResult = false;
    click(element, 'button[aria-label^="Eliminar"]');
    context.http.expectNone(`${DOCUMENTS_URL}/${DOCUMENT_ID}`);

    dialogResult = true;
    click(element, 'button[aria-label^="Eliminar"]');
    context.http
      .expectOne(`${DOCUMENTS_URL}/${DOCUMENT_ID}`)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(document.body.textContent).toContain('Tu rol solo permite consultar');

    click(element, 'button[aria-label^="Eliminar"]');
    const request = context.http.expectOne(`${DOCUMENTS_URL}/${DOCUMENT_ID}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await settle();
    await load([]);
    expect(document.body.textContent).toContain('Documento eliminado');
  });

  it('informa si los documentos no cargan', async () => {
    await open(null);

    expect(textOf(element)).toContain('No pudimos cargar los documentos');
  });
});

describe('DocumentDialog', () => {
  const dialogRef = { close: vi.fn() };
  let context: PageTestContext;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  beforeEach(async () => {
    dialogRef.close.mockReset();
    context = setUpPage({ providers: [{ provide: MatDialogRef, useValue: dialogRef }] });
    element = TestBed.createComponent(DocumentDialog).nativeElement;
    await settle();
  });

  function choose(file: File): void {
    const input = element.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  it('exige título y archivo, y sube el documento', async () => {
    click(element, 'button[type=submit]');
    await settle();
    expect(textOf(element)).toContain('Indica el título');
    expect(textOf(element)).toContain('Elige el archivo del documento');
    context.http.expectNone(DOCUMENTS_URL);

    choose(new File(['MZ'], 'virus.exe', { type: 'application/x-msdownload' }));
    await settle();
    expect(textOf(element)).toContain('El documento debe ser un PDF o una imagen JPG o PNG');

    const statutes = new File(['%PDF'], 'estatutos.pdf', { type: 'application/pdf' });
    choose(statutes);
    type(element, 'input[formcontrolname=title]', ' Estatutos ');
    type(element, 'input[formcontrolname=description]', ' Aprobados en 2020 ');
    await settle();
    expect(textOf(element)).toContain('estatutos.pdf');

    click(element, 'button[type=submit]');
    const request = context.http.expectOne(DOCUMENTS_URL);
    const body = request.request.body as FormData;
    expect(body.get('file')).toBe(statutes);
    expect(body.get('title')).toBe('Estatutos');
    expect(body.get('description')).toBe('Aprobados en 2020');
    request.flush(storedDocument());

    expect(dialogRef.close).toHaveBeenCalledWith(storedDocument());
  });

  it('no envía una descripción vacía y muestra el rechazo del servidor', async () => {
    choose(new File(['%PDF'], 'acta.pdf', { type: 'application/pdf' }));
    type(element, 'input[formcontrolname=title]', 'Acta');
    click(element, 'button[type=submit]');
    const request = context.http.expectOne(DOCUMENTS_URL);
    expect((request.request.body as FormData).has('description')).toBe(false);
    request.flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(textOf(element)).toContain('Tu rol solo permite consultar');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
