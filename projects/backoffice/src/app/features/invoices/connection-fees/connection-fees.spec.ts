import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { subscriber, SUBSCRIBER_ID } from '../../../../testing/subscriber-fixtures';
import { Subscriber } from '../../subscribers/subscriber.models';
import {
  CONNECTION_FEES_URL,
  ConnectionFeeDialog,
} from '../connection-fee-dialog/connection-fee-dialog';
import { ConnectionFees } from './connection-fees';

const LIST_URL = `${CONNECTION_FEES_URL}?subscriberId=${SUBSCRIBER_ID}`;

describe('Aportes por conexión', () => {
  let context: PageTestContext;

  afterEach(() => context.http.verify());

  describe('ConnectionFees', () => {
    it('marca al suscriptor como asociado y avisa el cambio', async () => {
      context = setUpPage();
      const fixture = TestBed.createComponent(ConnectionFees);
      fixture.componentRef.setInput('subscriber', subscriber());
      fixture.componentRef.setInput('editable', true);
      const changed: Subscriber[] = [];
      fixture.componentInstance.changed.subscribe((value) => changed.push(value));
      await settle();
      context.http.expectOne(LIST_URL).flush([]);
      await settle();
      expect(textOf(fixture.nativeElement)).toContain('No es asociado');

      fixture.componentInstance['toggleAssociate']();
      const updated = subscriber({ associate: true });
      context.http.expectOne(`/api/v1/subscribers/${SUBSCRIBER_ID}/associate`).flush(updated);

      expect(changed).toEqual([updated]);
    });
  });

  describe('ConnectionFeeDialog', () => {
    const dialogRef = { close: vi.fn() };

    function render(associate: boolean) {
      dialogRef.close.mockClear();
      context = setUpPage({
        providers: [
          { provide: MatDialogRef, useValue: dialogRef },
          { provide: MAT_DIALOG_DATA, useValue: { subscriberId: SUBSCRIBER_ID, associate } },
        ],
      });
      return TestBed.createComponent(ConnectionFeeDialog).componentInstance;
    }

    it('los costos particulares exigen su soporte', () => {
      const dialog = render(false);

      dialog['form'].patchValue({ materials: 100000, additionalCost: 50000 });
      dialog['submit']();
      context.http.expectNone(CONNECTION_FEES_URL);

      dialog['form'].patchValue({ additionalCostSupport: 'Acta de obra 12' });
      dialog['form'].controls.additionalCostSupport.updateValueAndValidity();
      dialog['submit']();
      const request = context.http.expectOne(CONNECTION_FEES_URL);
      expect(request.request.body).toMatchObject({
        subscriberId: SUBSCRIBER_ID,
        materials: 100000,
        additionalCost: 50000,
        additionalCostSupport: 'Acta de obra 12',
        installments: 1,
      });
      request.flush({ id: 'aporte' });
      expect(dialogRef.close).toHaveBeenCalled();
    });

    it('solo a los asociados se les cobra el reconocimiento', () => {
      const dialog = render(false);

      dialog['form'].patchValue({ materials: 100000, communityInvestment: 30000 });
      dialog['submit']();
      const request = context.http.expectOne(CONNECTION_FEES_URL);
      expect(request.request.body.communityInvestment).toBe(0);
      request.flush({ id: 'aporte' });
    });

    it('calcula el total a modo de orientación', () => {
      const dialog = render(true);

      dialog['form'].patchValue({ materials: 100000, labor: 50000, communityInvestment: 30000 });
      expect(dialog['total']()).toBe(180000);
    });
  });
});
