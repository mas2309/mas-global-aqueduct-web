import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { property, PROPERTY_ID, SUBSCRIBER_ID } from '../../../../testing/subscriber-fixtures';
import { MeterDialog, MeterDialogData } from '../meter-dialog/meter-dialog';
import { PropertyUsage } from '../subscriber.models';
import { PROPERTIES_URL, SUBSCRIBERS_URL } from '../subscribers-api';
import { PropertyDialog, PropertyDialogData } from './property-dialog';

const dialogRef = { close: vi.fn() };

function setUp(data: PropertyDialogData | MeterDialogData): PageTestContext {
  dialogRef.close.mockReset();
  return setUpPage({
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
}

const SERVICE_AREAS_URL = '/api/v1/service-areas';

describe('PropertyDialog', () => {
  let context: PageTestContext;

  afterEach(() => context.http.verify());

  async function render(data: PropertyDialogData, areas: unknown[] = []) {
    context = setUp(data);
    const fixture = TestBed.createComponent(PropertyDialog);
    await settle();
    context.http.expectOne(SERVICE_AREAS_URL).flush(areas);
    await fixture.whenStable();
    return fixture;
  }

  it('envía los datos catastrales y valida su formato', async () => {
    const fixture = await render({ subscriberId: SUBSCRIBER_ID });
    const element: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance as unknown as {
      form: { patchValue: (value: object) => void };
    };

    type(element, 'input[formcontrolname=address]', 'Vereda El Hato, casa 12');
    component.form.patchValue({ stratum: 1, municipalityCode: '155' });
    click(element, 'button[type=submit]');
    await fixture.whenStable();
    context.http.expectNone(`${SUBSCRIBERS_URL}/${SUBSCRIBER_ID}/properties`);

    component.form.patchValue({ municipalityCode: '15531' });
    click(element, 'button[type=submit]');
    const request = context.http.expectOne(`${SUBSCRIBERS_URL}/${SUBSCRIBER_ID}/properties`);
    expect(request.request.body.municipalityCode).toBe('15531');
    expect(request.request.body.cadastralNumber).toBeUndefined();
    request.flush({});
  });

  it('solo pregunta el área si el prestador registró alguna', async () => {
    const without = await render({ subscriberId: SUBSCRIBER_ID });
    expect(textOf(without.nativeElement)).not.toContain('Área de prestación');
    without.destroy();
  });

  it('exige el estrato en predios residenciales', async () => {
    const fixture = await render({ subscriberId: SUBSCRIBER_ID });
    const element: HTMLElement = fixture.nativeElement;

    type(element, 'input[formcontrolname=address]', 'Vereda El Hato, casa 12');
    click(element, 'button[type=submit]');
    await fixture.whenStable();

    expect(textOf(element)).toContain('Selecciona el estrato del predio');
    context.http.expectNone(`${SUBSCRIBERS_URL}/${SUBSCRIBER_ID}/properties`);
  });

  it('agrega un predio comercial sin estrato', async () => {
    const fixture = await render({ subscriberId: SUBSCRIBER_ID });
    const element: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance as unknown as {
      form: { controls: { usage: { setValue: (usage: PropertyUsage) => void } } };
    };

    type(element, 'input[formcontrolname=address]', '  Local 4, plaza principal ');
    component.form.controls.usage.setValue('COMMERCIAL');
    await fixture.whenStable();
    expect(textOf(element)).not.toContain('Estrato');
    click(element, 'button[type=submit]');

    const request = context.http.expectOne(`${SUBSCRIBERS_URL}/${SUBSCRIBER_ID}/properties`);
    expect(request.request.body).toEqual({
      address: 'Local 4, plaza principal',
      sector: null,
      usage: 'COMMERCIAL',
      stratum: null,
    });
    const saved = property({ usage: 'COMMERCIAL', stratum: null });
    request.flush(saved);

    expect(dialogRef.close).toHaveBeenCalledWith(saved);
  });

  it('edita un predio existente y muestra el rechazo del servidor', async () => {
    const fixture = await render({ subscriberId: SUBSCRIBER_ID, property: property() });
    const element: HTMLElement = fixture.nativeElement;

    expect(textOf(element)).toContain('Editar predio');
    type(element, 'input[formcontrolname=sector]', 'La Esperanza');
    click(element, 'button[type=submit]');
    const request = context.http.expectOne(`${PROPERTIES_URL}/${PROPERTY_ID}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      address: 'Vereda El Hato, casa 12',
      sector: 'La Esperanza',
      usage: 'RESIDENTIAL',
      stratum: 2,
    });
    request.flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(textOf(element)).toContain('Tu rol solo permite consultar');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});

describe('MeterDialog', () => {
  let context: PageTestContext;
  const url = `${PROPERTIES_URL}/${PROPERTY_ID}/services/WATER`;

  afterEach(() => context.http.verify());

  async function render(data: Partial<MeterDialogData> = {}) {
    context = setUp({
      propertyId: PROPERTY_ID,
      serviceType: 'WATER',
      currentMeter: null,
      connected: false,
      ...data,
    });
    const fixture = TestBed.createComponent(MeterDialog);
    await fixture.whenStable();
    return fixture;
  }

  it('conecta el servicio con su medidor', async () => {
    const fixture = await render();
    const element: HTMLElement = fixture.nativeElement;

    expect(textOf(element)).toContain('Conectar acueducto');
    type(element, 'input[formcontrolname=meterSerial]', ' MED-001 ');
    click(element, 'button[type=submit]');
    const request = context.http.expectOne(url);
    expect(request.request.body).toEqual({ meterSerial: 'MED-001' });
    request.flush(property());

    expect(dialogRef.close).toHaveBeenCalledWith(property());
  });

  it('permite conectar sin medidor', async () => {
    const fixture = await render();

    click(fixture.nativeElement, 'button[type=submit]');

    const request = context.http.expectOne(url);
    expect(request.request.body).toEqual({ meterSerial: null });
    request.flush(property());
  });

  it('avisa si el medidor ya está en otro predio', async () => {
    const fixture = await render({ currentMeter: 'MED-001', connected: true });
    const element: HTMLElement = fixture.nativeElement;

    expect(textOf(element)).toContain('Cambiar medidor de acueducto');
    type(element, 'input[formcontrolname=meterSerial]', 'MED-009');
    click(element, 'button[type=submit]');
    context.http.expectOne(url).flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(textOf(element)).toContain('Ese medidor ya está instalado en otro predio');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
