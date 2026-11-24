import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AQUEDUCT_ID } from '../../../../testing/fixtures';
import { click, PageTestContext, setUpPage, type } from '../../../../testing/setup';
import { Member } from '../member.models';
import { membersUrl } from '../members-api';
import { EditMemberDialog } from './edit-member-dialog';

function member(overrides: Partial<Member> = {}): Member {
  return {
    userId: 'u-1',
    email: 'fontanero@elhato.co',
    fullName: 'Fontanero',
    role: 'OPERATOR',
    userStatus: 'ACTIVE',
    memberSince: '2026-10-10T00:00:00Z',
    accountCreated: false,
    accountEditable: true,
    ...overrides,
  };
}

describe('EditMemberDialog', () => {
  let context: PageTestContext;
  const dialogRef = { close: vi.fn() };

  afterEach(() => context.http.verify());

  async function render(data: Member): Promise<HTMLElement> {
    dialogRef.close.mockReset();
    context = setUpPage({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { organizationId: AQUEDUCT_ID, member: data } },
      ],
    });
    const fixture = TestBed.createComponent(EditMemberDialog);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  it('cambia el nombre de una cuenta solo de este prestador', async () => {
    const element = await render(member());
    type(element, 'input[formcontrolname=fullName]', ' Fontanero Ruta 2 ');
    click(element, 'button[type=submit]');

    const request = context.http.expectOne(`${membersUrl(AQUEDUCT_ID)}/u-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ fullName: 'Fontanero Ruta 2', role: 'OPERATOR' });
    request.flush(member({ fullName: 'Fontanero Ruta 2' }));
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('de quien trabaja en otros prestadores solo cambia el rol', async () => {
    const element = await render(member({ accountEditable: false }));
    expect(
      element.querySelector<HTMLInputElement>('input[formcontrolname=fullName]')!.disabled,
    ).toBe(true);
    click(element, 'button[type=submit]');

    expect(context.http.expectOne(`${membersUrl(AQUEDUCT_ID)}/u-1`).request.body).toEqual({
      fullName: null,
      role: 'OPERATOR',
    });
  });
});
