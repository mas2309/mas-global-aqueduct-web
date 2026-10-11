import { ComponentFixture, TestBed } from '@angular/core/testing';
import { tariff } from '../../../../testing/billing-fixtures';
import { access, authResponse } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { ServiceType } from '../../organizations/organization.models';
import { Tariff } from '../tariff.models';
import { TARIFFS_URL } from '../tariffs-api';
import { TariffForm } from './tariff-form';

interface Actions {
  addBlock: () => void;
  removeBlock: (index: number) => void;
  addAdjustment: () => void;
  removeAdjustment: (index: number) => void;
  form: {
    controls: {
      fixedCharge: { setValue: (value: number) => void };
      blocks: { at: (index: number) => { controls: { upTo: { setValue: (v: number) => void } } } };
    };
  };
}

describe('TariffForm', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<TariffForm>;
  let element: HTMLElement;
  let actions: Actions;

  afterEach(() => context.http.verify());

  async function open(existing: Tariff[], servicio: ServiceType = 'WATER'): Promise<void> {
    context = setUpPage({
      session: authResponse({ organization: access({ role: 'ORG_ADMIN' }) }),
    });
    fixture = TestBed.createComponent(TariffForm);
    fixture.componentRef.setInput('servicio', servicio);
    element = fixture.nativeElement;
    actions = fixture.componentInstance as unknown as Actions;
    await settle();
    context.http.expectOne(`${TARIFFS_URL}?serviceType=${servicio}`).flush(existing);
    await settle();
  }

  async function submit(): Promise<void> {
    click(element, 'button[type=submit]');
    await settle();
  }

  it('parte de una copia de la tarifa más reciente', async () => {
    await open([tariff()]);

    expect(textOf(element)).toContain('Nueva tarifa de acueducto');
    expect(element.querySelectorAll('input[formcontrolname=upTo]')).toHaveLength(1);
    expect(element.querySelectorAll('input[formcontrolname=percent]')).toHaveLength(2);
    type(element, 'input[formcontrolname=validFrom]', '2027-01-01');
    type(element, 'input[formcontrolname=fixedCharge]', '9000');
    await submit();

    const request = context.http.expectOne(TARIFFS_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      serviceType: 'WATER',
      validFrom: '2027-01-01',
      fixedCharge: 9000,
      blocks: [
        { upTo: 10, pricePerUnit: 1500 },
        { upTo: null, pricePerUnit: 2500 },
      ],
      adjustments: [
        { usage: 'RESIDENTIAL', stratum: 1, percent: -50 },
        { usage: 'COMMERCIAL', stratum: null, percent: 20 },
      ],
    });
    request.flush(tariff({ validFrom: '2027-01-01', inEffect: false }));
    await settle();

    expect(document.body.textContent).toContain('Tarifa programada');
    expect(context.router.navigate).toHaveBeenCalledWith(['/tarifas'], {
      queryParams: { servicio: 'WATER' },
    });
  });

  it('crea la primera tarifa con un único precio', async () => {
    await open([]);

    actions.addBlock();
    actions.addAdjustment();
    await settle();
    expect(textOf(element)).toContain('Más de 10');
    actions.removeBlock(0);
    actions.removeAdjustment(0);
    await settle();
    expect(textOf(element)).toContain('Todo el consumo');
    type(element, 'input[formcontrolname=lastPrice]', '2000');
    await submit();

    const request = context.http.expectOne(TARIFFS_URL);
    expect(request.request.body.blocks).toEqual([{ upTo: null, pricePerUnit: 2000 }]);
    expect(request.request.body.adjustments).toEqual([]);
    request.flush(tariff());
    await settle();

    expect(document.body.textContent).toContain('Tarifa guardada: ya está vigente');
  });

  it('exige que los rangos vayan de menor a mayor', async () => {
    await open([]);

    actions.addBlock();
    actions.addBlock();
    actions.form.controls.blocks.at(1).controls.upTo.setValue(5);
    await submit();

    expect(textOf(element)).toContain('Los límites de los rangos deben ir de menor a mayor');
    context.http.expectNone(TARIFFS_URL);
  });

  it('no envía un formulario con valores inválidos', async () => {
    await open([]);

    actions.form.controls.fixedCharge.setValue(-1);
    await submit();

    expect(textOf(element)).toContain('Debe ser cero o más');
    context.http.expectNone(TARIFFS_URL);
  });

  it('un servicio sin medidor solo tiene cargo fijo', async () => {
    await open([], 'SANITATION');

    expect(textOf(element)).toContain('Nueva tarifa de aseo');
    expect(textOf(element)).not.toContain('Rangos de consumo');
    type(element, 'input[formcontrolname=fixedCharge]', '12000');
    await submit();

    const request = context.http.expectOne(TARIFFS_URL);
    expect(request.request.body).toMatchObject({
      serviceType: 'SANITATION',
      fixedCharge: 12000,
      blocks: [],
    });
    request.flush(tariff({ serviceType: 'SANITATION', blocks: [] }));
  });

  it('avisa si ya hay una tarifa con esa fecha', async () => {
    await open([tariff()]);

    await submit();
    context.http
      .expectOne(TARIFFS_URL)
      .flush({ status: 409 }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(document.body.textContent).toContain(
      'Ya existe una tarifa de este servicio con esa fecha de vigencia',
    );
    expect(context.router.navigate).not.toHaveBeenCalled();
  });
});
