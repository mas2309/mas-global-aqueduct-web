import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AQUEDUCT_ID } from '../../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { membersUrl } from '../members-api';
import { ResetPasswordDialog } from './reset-password-dialog';

describe('ResetPasswordDialog', () => {
  let context: PageTestContext;

  afterEach(() => context.http.verify());

  it('asigna una contraseña temporal y la muestra una vez para entregarla', async () => {
    context = setUpPage({
      providers: [
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            organizationId: AQUEDUCT_ID,
            member: { userId: 'u-1', fullName: 'Fontanero', email: 'f@elhato.co' },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ResetPasswordDialog);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    [...element.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => textOf(button).includes('Restablecer'))!
      .click();
    const request = context.http.expectOne(`${membersUrl(AQUEDUCT_ID)}/u-1/password`);
    const password = (request.request.body as { password: string }).password;
    expect(password).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    request.flush(null);
    await settle();

    expect(textOf(element)).toContain('Contraseña restablecida');
    expect(textOf(element)).toContain(password);
  });
});
