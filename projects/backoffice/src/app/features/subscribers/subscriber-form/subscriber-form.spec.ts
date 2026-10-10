import { ComponentFixture, TestBed } from '@angular/core/testing';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { subscriber, SUBSCRIBER_ID } from '../../../../testing/subscriber-fixtures';
import { DocumentType } from '../subscriber.models';
import { SUBSCRIBERS_URL } from '../subscribers-api';
import { SubscriberForm } from './subscriber-form';

describe('SubscriberForm', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<SubscriberForm>;
  let element: HTMLElement;

  beforeEach(() => {
    context = setUpPage();
    fixture = TestBed.createComponent(SubscriberForm);
    element = fixture.nativeElement;
  });

  afterEach(() => context.http.verify());

  function setDocumentType(value: DocumentType | ''): void {
    const component = fixture.componentInstance as unknown as {
      form: { controls: { documentType: { setValue: (value: DocumentType | '') => void } } };
    };
    component.form.controls.documentType.setValue(value);
  }

  async function submit(): Promise<void> {
    click(element, 'button[type=submit]');
    await settle();
  }

  it('registra un suscriptor sin documento y abre su ficha', async () => {
    await settle();
    type(element, 'input[formcontrolname=fullName]', '  María Gómez ');
    type(element, 'input[formcontrolname=phone]', '3001234567');
    await submit();

    const request = context.http.expectOne(SUBSCRIBERS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      fullName: 'María Gómez',
      documentType: null,
      documentNumber: null,
      email: null,
      phone: '3001234567',
    });
    request.flush(subscriber());
    await settle();

    expect(context.router.navigate).toHaveBeenCalledWith(['/suscriptores', SUBSCRIBER_ID]);
    expect(document.body.textContent).toContain('registrado con el código 000042');
  });

  it('exige tipo y número de documento juntos y valida el formato', async () => {
    await settle();
    type(element, 'input[formcontrolname=fullName]', 'María Gómez');
    type(element, 'input[formcontrolname=documentNumber]', '52123456');
    await submit();
    expect(textOf(element)).toContain('El tipo y el número de documento van juntos');

    setDocumentType('CC');
    type(element, 'input[formcontrolname=documentNumber]', '52.123.456');
    await submit();
    expect(textOf(element)).toContain('sin puntos');
    context.http.expectNone(SUBSCRIBERS_URL);
  });

  it('marca el documento si ya existe en el prestador', async () => {
    await settle();
    type(element, 'input[formcontrolname=fullName]', 'María Gómez');
    type(element, 'input[formcontrolname=documentNumber]', '52123456');
    setDocumentType('CC');
    await submit();

    context.http
      .expectOne(SUBSCRIBERS_URL)
      .flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(textOf(element)).toContain('Ya hay un suscriptor con este documento');
  });

  it('edita un suscriptor existente', async () => {
    const url = `${SUBSCRIBERS_URL}/${SUBSCRIBER_ID}`;
    fixture.componentRef.setInput('id', SUBSCRIBER_ID);
    await settle();
    context.http.expectOne(url).flush(subscriber());
    await settle();

    expect(textOf(element)).toContain('Editar suscriptor 000042');
    expect(element.querySelector<HTMLInputElement>('input[formcontrolname=fullName]')!.value).toBe(
      'María Gómez',
    );

    type(element, 'input[formcontrolname=fullName]', 'María Gómez de Ruiz');
    await submit();
    const request = context.http.expectOne((r) => r.url === url && r.method === 'PUT');
    expect(request.request.body).toEqual({
      fullName: 'María Gómez de Ruiz',
      documentType: 'CC',
      documentNumber: '52123456',
      email: null,
      phone: '3001234567',
    });
    request.flush(subscriber({ fullName: 'María Gómez de Ruiz' }));
    await settle();

    expect(document.body.textContent).toContain('Cambios guardados');
  });

  it('informa si el suscriptor no existe', async () => {
    fixture.componentRef.setInput('id', 'no-existe');
    await settle();
    context.http
      .expectOne(`${SUBSCRIBERS_URL}/no-existe`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(textOf(element)).toContain('No encontramos este suscriptor');
  });
});
