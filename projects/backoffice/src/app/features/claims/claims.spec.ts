import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { access, authResponse } from '../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../testing/setup';
import { subscriber, SUBSCRIBER_ID } from '../../../testing/subscriber-fixtures';
import { ClaimAnswerDialog } from './claim-answer-dialog/claim-answer-dialog';
import { ClaimDetail } from './claim-detail/claim-detail';
import { ClaimFormDialog } from './claim-form-dialog/claim-form-dialog';
import { ClaimList } from './claim-list/claim-list';
import { Claim, CLAIMS_URL, deadlineLabel } from './claim.models';

const CLAIM_ID = '77777777-7777-7777-7777-777777777777';

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: CLAIM_ID,
    number: 5,
    state: 'OPEN',
    businessDaysLeft: 10,
    subscriberId: SUBSCRIBER_ID,
    subscriberCode: 42,
    subscriberName: 'María Gómez',
    propertyId: null,
    invoiceId: null,
    type: 'CLAIM',
    channel: 'IN_PERSON',
    cause: 'Cobro excesivo',
    causeCode: null,
    description: 'El consumo no corresponde',
    disputedAmount: 0,
    filedOn: '2026-10-05',
    dueDate: '2026-10-27',
    decision: null,
    answer: null,
    owedAmount: null,
    answeredOn: null,
    notificationChannel: null,
    notifiedOn: null,
    attachments: [],
    ...overrides,
  };
}

describe('PQR', () => {
  let context: PageTestContext;

  afterEach(() => context.http.verify());

  describe('plazo', () => {
    it('dice cuánto falta o cuánto lleva vencida', () => {
      context = setUpPage();
      expect(deadlineLabel({ businessDaysLeft: 3 })).toBe('Quedan 3 días hábiles');
      expect(deadlineLabel({ businessDaysLeft: 1 })).toBe('Quedan 1 día hábil');
      expect(deadlineLabel({ businessDaysLeft: 0 })).toBe('Vence hoy');
      expect(deadlineLabel({ businessDaysLeft: -2 })).toBe('Vencida hace 2 días hábiles');
    });
  });

  describe('ClaimList', () => {
    it('lista las PQR con su suscriptor y avisa las que están por vencer', async () => {
      context = setUpPage();
      const fixture = TestBed.createComponent(ClaimList);
      await settle();
      context.http.expectOne(CLAIMS_URL).flush([claim({ businessDaysLeft: 2 })]);
      context.http.expectOne(`${CLAIMS_URL}/alerts`).flush([claim({ businessDaysLeft: 2 })]);
      await settle();
      const text = textOf(fixture.nativeElement);

      expect(text).toContain('000042 · María Gómez');
      expect(text).toContain('Reclamo: Cobro excesivo');
      expect(text).toContain('Quedan 2 días hábiles');
      expect(text).toContain('1 sin responder');
    });

    it('filtra por estado', async () => {
      context = setUpPage();
      const fixture = TestBed.createComponent(ClaimList);
      await settle();
      context.http.expectOne(CLAIMS_URL).flush([]);
      context.http.expectOne(`${CLAIMS_URL}/alerts`).flush([]);
      await settle();
      expect(textOf(fixture.nativeElement)).toContain('No hay PQR con este filtro');

      fixture.componentInstance['state'].set('ANSWERED');
      await settle();
      context.http.expectOne(`${CLAIMS_URL}?state=ANSWERED`).flush([claim({ state: 'ANSWERED' })]);
      await settle();
      expect(textOf(fixture.nativeElement)).toContain('Respondida');
    });
  });

  describe('ClaimDetail', () => {
    async function open(item: Claim, role: 'OPERATOR' | 'VIEWER' = 'OPERATOR') {
      context = setUpPage({
        session: authResponse({ organization: access({ role }) }),
        providers: [
          {
            provide: MatDialog,
            useValue: { open: () => ({ afterClosed: () => of(undefined) }) },
          },
        ],
      });
      const fixture = TestBed.createComponent(ClaimDetail);
      fixture.componentRef.setInput('id', CLAIM_ID);
      await settle();
      context.http.expectOne(`${CLAIMS_URL}/${CLAIM_ID}`).flush(item);
      await settle();
      return fixture;
    }

    it('sin responder ofrece responder, y un rol de consulta no', async () => {
      const fixture = await open(claim());
      expect(textOf(fixture.nativeElement)).toContain('Aún sin responder');
      expect(textOf(fixture.nativeElement)).toContain('Responder');
      TestBed.resetTestingModule();

      const viewer = await open(claim(), 'VIEWER');
      expect(textOf(viewer.nativeElement)).not.toContain('Adjuntar soporte');
    });

    it('respondida sin notificar ofrece registrar la notificación', async () => {
      const fixture = await open(
        claim({
          state: 'ANSWERED',
          decision: 'FAVORABLE',
          answer: 'Se corrige la lectura',
          answeredOn: '2026-10-10',
          owedAmount: 0,
        }),
      );
      const text = textOf(fixture.nativeElement);

      expect(text).toContain('Favorable al suscriptor');
      expect(text).toContain('Sin notificar');
      expect(text).toContain('Registrar notificación');
    });

    it('explica el silencio positivo', async () => {
      const fixture = await open(claim({ state: 'POSITIVE_SILENCE', businessDaysLeft: -4 }));
      expect(textOf(fixture.nativeElement)).toContain('resuelta a favor del suscriptor');
    });
  });

  describe('ClaimFormDialog', () => {
    const dialogRef = { close: vi.fn() };

    it('busca el suscriptor y radica un reclamo con el valor a congelar', async () => {
      dialogRef.close.mockClear();
      context = setUpPage({ providers: [{ provide: MatDialogRef, useValue: dialogRef }] });
      const fixture = TestBed.createComponent(ClaimFormDialog);
      const dialog = fixture.componentInstance;
      await settle();

      dialog['subscriber'].set(subscriber());
      await settle();
      context.http.expectOne(`/api/v1/subscribers/${SUBSCRIBER_ID}/properties`).flush([]);
      context.http
        .expectOne(`/api/v1/invoices?subscriberId=${SUBSCRIBER_ID}&size=12`)
        .flush({ items: [], page: 0, size: 12, totalItems: 0, totalPages: 0 });
      await settle();

      dialog['submit']();
      context.http.expectNone(CLAIMS_URL);

      dialog['form'].patchValue({
        type: 'CLAIM',
        cause: ' Cobro excesivo ',
        description: 'El consumo no corresponde',
        invoiceId: 'factura',
        disputedAmount: 5000,
      });
      dialog['submit']();
      const request = context.http.expectOne(CLAIMS_URL);
      expect(request.request.body).toMatchObject({
        subscriberId: SUBSCRIBER_ID,
        type: 'CLAIM',
        cause: 'Cobro excesivo',
        invoiceId: 'factura',
        disputedAmount: 5000,
        filedOn: null,
      });
      request.flush(claim());
      expect(dialogRef.close).toHaveBeenCalled();
    });

    it('una petición no congela ninguna factura', async () => {
      context = setUpPage({ providers: [{ provide: MatDialogRef, useValue: dialogRef }] });
      const dialog = TestBed.createComponent(ClaimFormDialog).componentInstance;
      await settle();
      dialog['subscriber'].set(subscriber());
      await settle();
      context.http.expectOne(`/api/v1/subscribers/${SUBSCRIBER_ID}/properties`).flush([]);
      context.http
        .expectOne(`/api/v1/invoices?subscriberId=${SUBSCRIBER_ID}&size=12`)
        .flush({ items: [], page: 0, size: 12, totalItems: 0, totalPages: 0 });

      dialog['form'].patchValue({
        type: 'PETITION',
        cause: 'Información',
        description: 'Pide copia del contrato',
        invoiceId: 'factura',
        disputedAmount: 5000,
      });
      dialog['submit']();
      const request = context.http.expectOne(CLAIMS_URL);
      expect(request.request.body.invoiceId).toBeNull();
      expect(request.request.body.disputedAmount).toBeNull();
      request.flush(claim({ type: 'PETITION' }));
    });
  });

  describe('ClaimAnswerDialog', () => {
    const dialogRef = { close: vi.fn() };

    function render(item: Claim) {
      context = setUpPage({
        providers: [
          { provide: MatDialogRef, useValue: dialogRef },
          { provide: MAT_DIALOG_DATA, useValue: item },
        ],
      });
      return TestBed.createComponent(ClaimAnswerDialog).componentInstance;
    }

    it('una respuesta parcial exige lo que debe, sin pasar de lo congelado', () => {
      const dialog = render(claim({ disputedAmount: 5000 }));

      dialog['form'].patchValue({ decision: 'PARTIAL', text: 'Se reconoce una parte' });
      dialog['submit']();
      context.http.expectNone(`${CLAIMS_URL}/${CLAIM_ID}/answer`);

      dialog['form'].patchValue({ owedAmount: 6000 });
      dialog['submit']();
      context.http.expectNone(`${CLAIMS_URL}/${CLAIM_ID}/answer`);

      dialog['form'].patchValue({ owedAmount: 2000 });
      dialog['form'].controls.owedAmount.updateValueAndValidity();
      dialog['submit']();
      const request = context.http.expectOne(`${CLAIMS_URL}/${CLAIM_ID}/answer`);
      expect(request.request.body).toEqual({
        decision: 'PARTIAL',
        text: 'Se reconoce una parte',
        owedAmount: 2000,
      });
      request.flush(claim({ state: 'ANSWERED' }));
    });

    it('una respuesta favorable no envía valor', () => {
      const dialog = render(claim({ disputedAmount: 5000 }));

      dialog['form'].patchValue({ decision: 'FAVORABLE', text: 'Se corrige', owedAmount: 100 });
      dialog['submit']();
      const request = context.http.expectOne(`${CLAIMS_URL}/${CLAIM_ID}/answer`);
      expect(request.request.body.owedAmount).toBeNull();
      request.flush(claim({ state: 'ANSWERED' }));
    });
  });
});
