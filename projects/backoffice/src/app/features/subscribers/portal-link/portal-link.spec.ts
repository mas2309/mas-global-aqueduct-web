import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { SUBSCRIBER_ID } from '../../../../testing/subscriber-fixtures';
import { SUBSCRIBERS_URL } from '../subscribers-api';
import { PortalLink } from './portal-link';

const LINK_URL = `${SUBSCRIBERS_URL}/${SUBSCRIBER_ID}/portal-link`;
const URL_A = 'https://portal.test/p/token-a';
const URL_B = 'https://portal.test/p/token-b';

describe('PortalLink', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<PortalLink>;
  let element: HTMLElement;
  let dialogResult: unknown;

  afterEach(() => {
    context.http.verify();
    vi.unstubAllGlobals();
  });

  async function open(url: string | null | undefined, editable = true): Promise<void> {
    dialogResult = true;
    context = setUpPage({
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(PortalLink);
    fixture.componentRef.setInput('subscriberId', SUBSCRIBER_ID);
    fixture.componentRef.setInput('editable', editable);
    element = fixture.nativeElement;
    await settle();
    const request = context.http.expectOne(LINK_URL);
    if (url === undefined) {
      request.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      request.flush({ url });
    }
    await settle();
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      textOf(candidate).includes(label),
    );
  }

  it('muestra el enlace y lo copia', async () => {
    await open(URL_A);
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    expect(element.querySelector(`a[href="${URL_A}"]`)).not.toBeNull();
    button('Copiar')?.click();
    await settle();

    expect(writeText).toHaveBeenCalledWith(URL_A);
    expect(document.body.textContent).toContain('Enlace copiado');
  });

  it('avisa si el navegador no deja copiar', async () => {
    await open(URL_A);
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('no')) } });

    button('Copiar')?.click();
    await settle();

    expect(document.body.textContent).toContain('No se pudo copiar');
  });

  it('cambia el enlace solo si se confirma', async () => {
    await open(URL_A);

    dialogResult = false;
    button('Cambiar enlace')?.click();
    context.http.expectNone(`${LINK_URL}/rotate`);

    dialogResult = true;
    button('Cambiar enlace')?.click();
    const request = context.http.expectOne(`${LINK_URL}/rotate`);
    expect(request.request.method).toBe('POST');
    request.flush({ url: URL_B });
    await settle();

    expect(element.querySelector(`a[href="${URL_B}"]`)).not.toBeNull();
    expect(document.body.textContent).toContain('Enlace del portal cambiado');
  });

  it('avisa si el cambio es rechazado', async () => {
    await open(URL_A);

    button('Cambiar enlace')?.click();
    context.http
      .expectOne(`${LINK_URL}/rotate`)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(document.body.textContent).toContain('Tu rol solo permite consultar');
    expect(element.querySelector(`a[href="${URL_A}"]`)).not.toBeNull();
  });

  it('sin permiso solo consulta; sin portal configurado o con error lo explica', async () => {
    await open(URL_A, false);
    expect(button('Copiar')).toBeDefined();
    expect(button('Cambiar enlace')).toBeUndefined();
    TestBed.resetTestingModule();

    await open(null);
    expect(textOf(element)).toContain('no está configurado en este ambiente');
    TestBed.resetTestingModule();

    await open(undefined);
    expect(textOf(element)).toContain('No pudimos cargar el enlace del portal');
  });
});
