import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { access, authResponse } from '../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../testing/setup';
import { PROPERTY_ID, SUBSCRIBER_ID } from '../../../testing/subscriber-fixtures';
import { Candidate, DISCONNECTIONS_URL, DisconnectionRules } from './disconnection.models';
import { DisconnectionsPage } from './disconnections-page/disconnections-page';
import {
  ServiceActionData,
  ServiceActionDialog,
} from './service-action-dialog/service-action-dialog';

const RULES: DisconnectionRules = {
  suspendAfterUnpaidPeriods: null,
  cutAfterUnpaidPeriods: null,
  reconnectionFee: 0,
  reinstatementFee: 0,
  paymentRequiredToRestore: true,
  causes: ['Falta de pago', 'Reparación'],
};

const CANDIDATE: Candidate = {
  propertyId: PROPERTY_ID,
  propertyCode: 7,
  subscriberId: SUBSCRIBER_ID,
  subscriberCode: 42,
  subscriberName: 'María Gómez',
  address: 'Vereda El Hato, casa 12',
  serviceType: 'WATER',
  status: 'ACTIVE',
  unpaidPeriods: 3,
  owed: 45000,
  action: 'SUSPEND',
};

const SERVICE_URL = `${DISCONNECTIONS_URL}/properties/${PROPERTY_ID}/services/WATER`;

describe('Suspensión y corte', () => {
  let context: PageTestContext;

  afterEach(() => context.http.verify());

  describe('DisconnectionsPage', () => {
    async function open(
      candidates: Candidate[],
      rules = RULES,
      role: 'ORG_ADMIN' | 'VIEWER' = 'ORG_ADMIN',
    ) {
      context = setUpPage({
        session: authResponse({ organization: access({ role }) }),
        providers: [
          { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
        ],
      });
      const fixture = TestBed.createComponent(DisconnectionsPage);
      await settle();
      context.http.expectOne(`${DISCONNECTIONS_URL}/rules`).flush(rules);
      context.http.expectOne(`${DISCONNECTIONS_URL}/candidates`).flush(candidates);
      await settle();
      return fixture;
    }

    it('sin reglas explica que aún no hay sugerencias', async () => {
      const fixture = await open([]);
      expect(textOf(fixture.nativeElement)).toContain('Aún no hay sugerencias');
    });

    it('muestra las acometidas sugeridas', async () => {
      const fixture = await open([CANDIDATE], { ...RULES, suspendAfterUnpaidPeriods: 2 });
      const text = textOf(fixture.nativeElement);

      expect(text).toContain('000042 · María Gómez');
      expect(text).toContain('Suspensión');
      expect(text).toContain('Registrar');
    });

    it('guarda las reglas con una causal por línea y recarga las sugerencias', async () => {
      const fixture = await open([]);
      const page = fixture.componentInstance;

      page['form'].patchValue({ suspendAfterUnpaidPeriods: 2, causes: ' Falta de pago \n\nFraude ' });
      page['save']();
      const request = context.http.expectOne(`${DISCONNECTIONS_URL}/rules`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toMatchObject({
        suspendAfterUnpaidPeriods: 2,
        causes: ['Falta de pago', 'Fraude'],
      });
      request.flush({ ...RULES, suspendAfterUnpaidPeriods: 2 });
      await settle();
      context.http.expectOne(`${DISCONNECTIONS_URL}/candidates`).flush([]);
      await settle();
    });

    it('un rol de consulta ve las reglas pero no las cambia', async () => {
      const fixture = await open([CANDIDATE], RULES, 'VIEWER');

      expect(fixture.componentInstance['form'].disabled).toBe(true);
      expect(textOf(fixture.nativeElement)).not.toContain('Guardar reglas');
      expect(textOf(fixture.nativeElement)).not.toContain('Registrar');
    });
  });

  describe('ServiceActionDialog', () => {
    const dialogRef = { close: vi.fn() };

    function render(action: ServiceActionData['action'], role: 'ORG_ADMIN' | 'OPERATOR') {
      dialogRef.close.mockClear();
      const data: ServiceActionData = {
        propertyId: PROPERTY_ID,
        address: 'Casa 12',
        serviceType: 'WATER',
        action,
        title: 'Registrar',
      };
      context = setUpPage({
        session: authResponse({ organization: access({ role }) }),
        providers: [
          { provide: MatDialogRef, useValue: dialogRef },
          { provide: MAT_DIALOG_DATA, useValue: data },
        ],
      });
      return TestBed.createComponent(ServiceActionDialog);
    }

    it('suspender exige una de las causales configuradas', async () => {
      const fixture = render('SUSPEND', 'OPERATOR');
      const dialog = fixture.componentInstance;
      await settle();
      context.http.expectOne(`${DISCONNECTIONS_URL}/rules`).flush(RULES);
      await settle();

      dialog['submit']();
      context.http.expectNone(`${SERVICE_URL}/suspend`);

      dialog['form'].patchValue({ cause: 'Falta de pago' });
      dialog['submit']();
      const request = context.http.expectOne(`${SERVICE_URL}/suspend`);
      expect(request.request.body).toEqual({ cause: 'Falta de pago', notes: null });
      request.flush({ id: 'evento' });
      expect(dialogRef.close).toHaveBeenCalled();
    });

    it('restablecer con deuda: el administrador autoriza indicando el motivo', async () => {
      const fixture = render('RESTORE', 'ORG_ADMIN');
      const dialog = fixture.componentInstance;
      await settle();
      expect(textOf(fixture.nativeElement)).toContain('Autorizar aunque tenga deuda vencida');

      dialog['form'].patchValue({ override: true });
      dialog['submit']();
      context.http.expectNone(`${SERVICE_URL}/restore`);

      dialog['form'].patchValue({ notes: 'Acuerdo de pago firmado' });
      dialog['form'].controls.notes.updateValueAndValidity();
      dialog['submit']();
      const request = context.http.expectOne(`${SERVICE_URL}/restore`);
      expect(request.request.body).toEqual({ notes: 'Acuerdo de pago firmado', override: true });
      request.flush({ id: 'evento' });
    });

    it('un operador no ve la autorización y entiende el rechazo por deuda', async () => {
      const fixture = render('RESTORE', 'OPERATOR');
      const dialog = fixture.componentInstance;
      await settle();
      expect(textOf(fixture.nativeElement)).not.toContain('Autorizar');

      dialog['submit']();
      context.http
        .expectOne(`${SERVICE_URL}/restore`)
        .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
      await settle();

      expect(textOf(fixture.nativeElement)).toContain('Tiene deuda vencida');
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
