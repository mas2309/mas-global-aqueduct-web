import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AQUEDUCT_ID } from '../../../../testing/fixtures';
import { click, PageTestContext, setUpPage, textOf, type } from '../../../../testing/setup';
import { Member } from '../member.models';
import { membersUrl } from '../members-api';
import { generateTemporaryPassword } from '../temporary-password';
import { AddMemberDialog } from './add-member-dialog';

const URL = membersUrl(AQUEDUCT_ID);

const created: Member = {
  userId: 'u-9',
  email: 'nuevo@elhato.co',
  fullName: 'Nuevo Lector',
  role: 'OPERATOR',
  userStatus: 'ACTIVE',
  memberSince: '2026-10-10T00:00:00Z',
  accountCreated: true,
};

describe('AddMemberDialog', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<AddMemberDialog>;
  let element: HTMLElement;
  const dialogRef = { close: vi.fn() };

  beforeEach(async () => {
    dialogRef.close.mockReset();
    context = setUpPage({
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { organizationId: AQUEDUCT_ID, organizationName: 'Acueducto El Hato' },
        },
      ],
    });
    fixture = TestBed.createComponent(AddMemberDialog);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => context.http.verify());

  async function submit(): Promise<void> {
    click(element, 'button[type=submit]');
    await fixture.whenStable();
  }

  it('valida el correo y la longitud de la contraseña temporal', async () => {
    type(element, 'input[formcontrolname=email]', 'no-es-correo');
    type(element, 'input[formcontrolname=password]', 'corta');
    await submit();

    expect(textOf(element)).toContain('El correo no es válido');
    expect(textOf(element)).toContain('Debe tener al menos 10 caracteres');
    context.http.expectNone(URL);
  });

  it('crea la cuenta y muestra la contraseña temporal para entregarla', async () => {
    type(element, 'input[formcontrolname=email]', ' nuevo@elhato.co ');
    type(element, 'input[formcontrolname=fullName]', 'Nuevo Lector');
    click(element, 'button[aria-label="Generar contraseña temporal"]');
    await fixture.whenStable();
    const password = element.querySelector<HTMLInputElement>(
      'input[formcontrolname=password]',
    )!.value;
    expect(password).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    await submit();

    const request = context.http.expectOne(URL);
    expect(request.request.body).toEqual({
      email: 'nuevo@elhato.co',
      role: 'OPERATOR',
      fullName: 'Nuevo Lector',
      password,
    });
    request.flush(created);
    await fixture.whenStable();

    expect(textOf(element)).toContain('Cuenta creada');
    expect(textOf(element)).toContain(password);
    expect(dialogRef.close).not.toHaveBeenCalled();

    click(element, 'mat-dialog-actions button');
    expect(dialogRef.close).toHaveBeenCalledWith(created);
  });

  it('si la persona ya tenía cuenta solo le da acceso, sin mostrar contraseña', async () => {
    type(element, 'input[formcontrolname=email]', 'luis@otro.co');
    await submit();

    const request = context.http.expectOne(URL);
    expect(request.request.body).toEqual({ email: 'luis@otro.co', role: 'OPERATOR' });
    const existing = { ...created, accountCreated: false };
    request.flush(existing);
    await fixture.whenStable();

    expect(dialogRef.close).toHaveBeenCalledWith(existing);
  });

  it('pide nombre y contraseña si la persona aún no tiene cuenta', async () => {
    type(element, 'input[formcontrolname=email]', 'nuevo@elhato.co');
    await submit();

    context.http
      .expectOne(URL)
      .flush({ status: 400, detail: 'required' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();

    expect(textOf(element)).toContain(
      'aún no tiene cuenta: escribe su nombre y una contraseña temporal',
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('muestra los errores de campo del servidor y otros rechazos', async () => {
    type(element, 'input[formcontrolname=email]', 'nuevo@elhato.co');
    type(element, 'input[formcontrolname=fullName]', 'Nuevo Lector');
    type(element, 'input[formcontrolname=password]', 'aaaaaaaaaaaa');
    await submit();
    context.http
      .expectOne(URL)
      .flush({ status: 400, detail: 'weak' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(textOf(element)).toContain('no puede ser el correo ni repetir un solo carácter');

    await submit();
    context.http
      .expectOne(URL)
      .flush(
        { status: 400, errors: { email: 'must be a well-formed email address' } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      form: { controls: { email: { getError: (code: string) => unknown } } };
    };
    expect(component.form.controls.email.getError('server')).toBe(
      'must be a well-formed email address',
    );
  });
});

describe('generateTemporaryPassword', () => {
  it('genera contraseñas distintas que cumplen la política y son fáciles de dictar', () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));

    expect(passwords.size).toBe(50);
    for (const password of passwords) {
      expect(password.length).toBeGreaterThanOrEqual(10);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });
});
