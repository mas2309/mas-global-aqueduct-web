import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { textOf } from '../../../testing/setup';
import { SpanishPaginatorIntl } from '../../core/i18n/spanish-paginator-intl';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('muestra el mensaje y marca las acciones destructivas', async () => {
    const data: ConfirmDialogData = {
      title: 'Suspender prestador',
      message: 'No podrá facturar.',
      confirmLabel: 'Suspender',
      danger: true,
    };
    TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialog);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(textOf(element)).toContain('Suspender prestador');
    expect(textOf(element)).toContain('No podrá facturar.');
    expect(element.querySelector('button.danger')?.textContent).toContain('Suspender');
  });
});

describe('SpanishPaginatorIntl', () => {
  it('traduce el rango de resultados', () => {
    const intl: MatPaginatorIntl = new SpanishPaginatorIntl();

    expect(intl.itemsPerPageLabel).toBe('Por página');
    expect(intl.getRangeLabel(0, 20, 0)).toBe('0 de 0');
    expect(intl.getRangeLabel(1, 20, 45)).toBe('21 – 40 de 45');
    expect(intl.getRangeLabel(2, 20, 45)).toBe('41 – 45 de 45');
  });
});
