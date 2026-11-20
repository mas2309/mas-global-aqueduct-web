import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { HISTORY_IMPORT_URL, HistoryImport } from './history-import';

describe('HistoryImport', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<HistoryImport>;
  let element: HTMLElement;
  const csv = new File(['medidor;periodo;consumo\nMED-001;2026-05;12\n'], 'historial.csv', {
    type: 'text/csv',
  });

  beforeEach(async () => {
    context = setUpPage();
    fixture = TestBed.createComponent(HistoryImport);
    element = fixture.nativeElement;
    await settle();
  });

  afterEach(() => context.http.verify());

  function choose(): void {
    const input = element.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [csv], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  function upload(validateOnly: boolean) {
    return context.http.expectOne(
      (candidate) =>
        candidate.url === HISTORY_IMPORT_URL &&
        candidate.params.get('validateOnly') === String(validateOnly),
    );
  }

  it('revisa el historial al elegirlo y lo importa si está bien', async () => {
    choose();
    upload(true).flush({ rows: 6, imported: 0, errors: [] });
    await settle();
    expect(textOf(element)).toContain('historial.csv está bien: 6 consumos para importar');

    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => textOf(button).includes('Importar historial'))
      ?.click();
    upload(false).flush({ rows: 6, imported: 6, errors: [] });
    await settle();

    expect(textOf(element)).toContain('Se importaron 6 consumos');
  });

  it('dice qué línea corregir y no importa nada', async () => {
    choose();
    upload(true).flush({
      rows: 2,
      imported: 0,
      errors: [{ line: 3, message: 'No hay un predio con el medidor MED-999 en acueducto' }],
    });
    await settle();

    const text = textOf(element);
    expect(text).toContain('historial.csv tiene errores: no se importó nada');
    expect(text).toContain('No hay un predio con el medidor MED-999 en acueducto');
    expect(text).not.toContain('Importar historial');
  });
});
