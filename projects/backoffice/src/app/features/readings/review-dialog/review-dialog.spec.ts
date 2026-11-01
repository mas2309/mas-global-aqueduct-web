import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { reading, READING_ID } from '../../../../testing/billing-fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { READINGS_URL } from '../readings-api';
import { ReviewDialog, ReviewDialogData } from './review-dialog';

const REVIEW_URL = `${READINGS_URL}/${READING_ID}/review`;

describe('ReviewDialog', () => {
  const dialogRef = { close: vi.fn() };
  let context: PageTestContext;
  let dialog: ReviewDialog;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function render(): Promise<void> {
    dialogRef.close.mockClear();
    const data: ReviewDialogData = {
      reading: reading({ unusual: true, reviewStatus: 'PENDING', consumption: 40 }),
      subscriberName: 'María Gómez',
      unit: 'm³',
    };
    context = setUpPage({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(ReviewDialog);
    dialog = fixture.componentInstance;
    element = fixture.nativeElement;
    await settle();
  }

  it('exige indicar qué se encontró', async () => {
    await render();

    expect(textOf(element)).toContain('consumo de 40 m³');
    dialog['submit']();

    context.http.expectNone(REVIEW_URL);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('confirma la lectura sin enviar un valor corregido', async () => {
    await render();

    dialog['form'].controls.notes.setValue(' Fuga real en el patio ');
    dialog['submit']();

    const request = context.http.expectOne(REVIEW_URL);
    expect(request.request.body).toEqual({ outcome: 'CONFIRM', notes: 'Fuga real en el patio' });
    const reviewed = reading({ reviewStatus: 'RESOLVED' });
    request.flush(reviewed);
    expect(dialogRef.close).toHaveBeenCalledWith(reviewed);
  });

  it('corregir exige la lectura correcta y la envía', async () => {
    await render();

    dialog['form'].patchValue({ outcome: 'CORRECT', currentReading: null, notes: 'Mal digitada' });
    dialog['submit']();
    context.http.expectNone(REVIEW_URL);

    dialog['form'].patchValue({ currentReading: 128 });
    dialog['submit']();
    const request = context.http.expectOne(REVIEW_URL);
    expect(request.request.body).toEqual({
      outcome: 'CORRECT',
      currentReading: 128,
      notes: 'Mal digitada',
    });
    request.flush(reading({ reviewStatus: 'RESOLVED', currentReading: 128 }));
  });

  it('muestra el rechazo del servidor y no cierra', async () => {
    await render();

    dialog['form'].patchValue({ outcome: 'ESTIMATE', notes: 'Medidor dañado' });
    dialog['submit']();
    context.http
      .expectOne(REVIEW_URL)
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();

    expect(textOf(element)).toContain('no tiene historia para estimar');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
