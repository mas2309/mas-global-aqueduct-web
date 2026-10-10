import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AQUEDUCT_ID, organization } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { ORGANIZATIONS_URL } from '../organizations-api';
import { OrganizationForm } from './organization-form';

describe('OrganizationForm', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<OrganizationForm>;
  let element: HTMLElement;

  beforeEach(() => {
    context = setUpPage();
    fixture = TestBed.createComponent(OrganizationForm);
    element = fixture.nativeElement;
  });

  afterEach(() => context.http.verify());

  async function submit(): Promise<void> {
    click(element, 'button[type=submit]');
    await settle();
  }

  describe('al crear', () => {
    beforeEach(async () => {
      await settle();
    });

    async function fillRequired(nit: string): Promise<void> {
      type(element, 'input[formcontrolname=nit]', nit);
      type(element, 'input[formcontrolname=legalName]', 'Acueducto Vereda La Esperanza');
      type(element, 'input[formcontrolname=municipalityCode]', '25899');
      await settle();
    }

    it('indica el dígito de verificación correcto del NIT', async () => {
      await fillRequired('900123456-7');
      await submit();

      expect(textOf(element)).toContain('Vincular prestador');
      expect(textOf(element)).toContain('debería ser 8');
      context.http.expectNone(ORGANIZATIONS_URL);
    });

    it('exige al menos un servicio', async () => {
      await fillRequired('900123456-8');
      click(element, 'mat-checkbox input');
      await settle();
      await submit();

      expect(textOf(element)).toContain('Selecciona al menos un servicio');
      context.http.expectNone(ORGANIZATIONS_URL);
    });

    it('vincula el prestador y abre su detalle', async () => {
      await fillRequired('900.123.456-8');
      element.querySelectorAll<HTMLInputElement>('mat-checkbox input')[2].click();
      type(element, 'input[formcontrolname=email]', ' admin@laesperanza.co ');
      await settle();
      await submit();

      const request = context.http.expectOne(ORGANIZATIONS_URL);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        nit: '900.123.456-8',
        legalName: 'Acueducto Vereda La Esperanza',
        tradeName: null,
        type: 'COMMUNITY_AQUEDUCT',
        municipalityCode: '25899',
        email: 'admin@laesperanza.co',
        phone: null,
        services: ['WATER', 'SANITATION'],
      });
      request.flush(organization());
      await settle();

      expect(context.router.navigate).toHaveBeenCalledWith(['/prestadores', AQUEDUCT_ID]);
    });

    it('marca el NIT si ya está registrado', async () => {
      await fillRequired('900123456-8');
      await submit();

      context.http
        .expectOne(ORGANIZATIONS_URL)
        .flush({ status: 409, detail: 'duplicate' }, { status: 409, statusText: 'Conflict' });
      await settle();

      expect(textOf(element)).toContain('Ya existe un prestador con este NIT');
    });
  });

  describe('al editar', () => {
    const url = `${ORGANIZATIONS_URL}/${AQUEDUCT_ID}`;

    async function open(): Promise<void> {
      fixture.componentRef.setInput('id', AQUEDUCT_ID);
      await settle();
      context.http
        .expectOne(url)
        .flush(organization({ email: 'admin@elhato.co', services: ['WATER', 'SANITATION'] }));
      await settle();
    }

    function input(name: string): HTMLInputElement {
      return element.querySelector<HTMLInputElement>(`input[formcontrolname=${name}]`)!;
    }

    it('carga los datos actuales con el NIT bloqueado y sin la sección de servicios', async () => {
      await open();

      expect(textOf(element)).toContain('Editar prestador');
      expect(input('nit').value).toBe('900123456-8');
      expect(input('nit').disabled).toBe(true);
      expect(input('legalName').value).toBe('Asociación de Usuarios Acueducto El Hato');
      expect(input('email').value).toBe('admin@elhato.co');
      expect(textOf(element)).toContain('El NIT no se puede cambiar');
      expect(element.querySelector('mat-checkbox')).toBeNull();
    });

    it('guarda los cambios sin enviar NIT ni servicios y vuelve al detalle', async () => {
      await open();
      type(element, 'input[formcontrolname=legalName]', 'Acueducto Regional El Hato');
      type(element, 'input[formcontrolname=tradeName]', '');
      type(element, 'input[formcontrolname=phone]', '3001234567');
      await settle();
      await submit();

      const request = context.http.expectOne(url);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({
        legalName: 'Acueducto Regional El Hato',
        tradeName: null,
        type: 'COMMUNITY_AQUEDUCT',
        municipalityCode: '25899',
        email: 'admin@elhato.co',
        phone: '3001234567',
      });
      request.flush(organization({ legalName: 'Acueducto Regional El Hato' }));
      await settle();

      expect(context.router.navigate).toHaveBeenCalledWith(['/prestadores', AQUEDUCT_ID]);
      expect(document.body.textContent).toContain('Cambios guardados');
    });

    it('explica por qué no se puede cambiar el tipo con vinculaciones activas', async () => {
      await open();
      await submit();

      context.http
        .expectOne((request) => request.url === url && request.method === 'PUT')
        .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
      await settle();

      expect(document.body.textContent).toContain('tenga vinculaciones activas');
      expect(context.router.navigate).not.toHaveBeenCalled();
    });

    it('informa si el prestador no existe', async () => {
      fixture.componentRef.setInput('id', 'no-existe');
      await settle();
      context.http
        .expectOne(`${ORGANIZATIONS_URL}/no-existe`)
        .flush(null, { status: 404, statusText: 'Not Found' });
      await settle();

      expect(textOf(element)).toContain('No encontramos este prestador');
      expect(element.querySelector('form')).toBeNull();
    });
  });
});
