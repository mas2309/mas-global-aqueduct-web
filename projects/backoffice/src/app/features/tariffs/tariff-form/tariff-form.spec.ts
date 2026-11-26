import { ComponentFixture, TestBed } from '@angular/core/testing';
import { tariff } from '../../../../testing/billing-fixtures';
import { access, authResponse } from '../../../../testing/fixtures';
import { click, PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { ServiceType } from '../../organizations/organization.models';
import { REGULATORY_PROFILE_URL, RegulatoryProfile } from '../../regulatory/regulatory.models';
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

  /** @param invoiceDiscountsAllowed lo que dice el perfil regulatorio del prestador */
  async function open(
    existing: Tariff[],
    servicio: ServiceType = 'WATER',
    invoiceDiscountsAllowed = true,
  ): Promise<void> {
    context = setUpPage({
      session: authResponse({ organization: access({ role: 'ORG_ADMIN' }) }),
    });
    fixture = TestBed.createComponent(TariffForm);
    fixture.componentRef.setInput('servicio', servicio);
    element = fixture.nativeElement;
    actions = fixture.componentInstance as unknown as Actions;
    await settle();
    context.http
      .expectOne(REGULATORY_PROFILE_URL)
      .flush({ rules: { invoiceDiscountsAllowed } } as Partial<RegulatoryProfile>);
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
    expect(element.querySelectorAll('input[formcontrolname=value]')).toHaveLength(2);
    // Solo el subsidio elige qué cubre; la contribución va sobre todo lo facturado
    expect(element.querySelectorAll('mat-select[formcontrolname=base]')).toHaveLength(1);
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
        {
          usage: 'RESIDENTIAL',
          stratum: 1,
          percent: -50,
          base: 'FIXED_CHARGE_AND_BASIC_CONSUMPTION',
        },
        { usage: 'COMMERCIAL', stratum: null, percent: 20 },
      ],
      invoiceDiscounts: [],
    });
    request.flush(tariff({ validFrom: '2027-01-01', inEffect: false }));
    await settle();

    expect(document.body.textContent).toContain('Tarifa programada');
    expect(context.router.navigate).toHaveBeenCalledWith(['/tarifas'], {
      queryParams: { servicio: 'WATER' },
    });
  });

  it('copia y envía subsidios en pesos, qué cubre cada uno y el subsidio sobre el total', async () => {
    // Chiquinquirá: valor por estrato con 40 m³ incluidos; Cucaita: el estrato 2 subsidia solo el cargo
    // fijo y además el 10 % de toda la factura; el estrato 3, el cargo fijo y el consumo básico
    await open([
      tariff({
        fixedCharge: 20000,
        blocks: [
          { upTo: 40, pricePerUnit: 0 },
          { upTo: null, pricePerUnit: 1000 },
        ],
        adjustments: [
          { usage: 'RESIDENTIAL', stratum: 1, percent: null, amount: -12000, base: 'FIXED_CHARGE' },
          { usage: 'RESIDENTIAL', stratum: 2, percent: -50, base: 'FIXED_CHARGE' },
          {
            usage: 'RESIDENTIAL',
            stratum: 3,
            percent: -15,
            base: 'FIXED_CHARGE_AND_BASIC_CONSUMPTION',
          },
        ],
        invoiceDiscounts: [{ usage: 'RESIDENTIAL', stratum: 2, percent: 10 }],
      }),
    ]);

    expect(element.querySelectorAll('mat-select[formcontrolname=base]')).toHaveLength(3);
    expect(textOf(element)).toContain('Solo el cargo fijo');
    expect(textOf(element)).toContain('quien no paga recibe el descuento otra vez');
    expect(element.querySelectorAll('input[formcontrolname=percent]')).toHaveLength(1);
    await submit();

    const request = context.http.expectOne(TARIFFS_URL);
    expect(request.request.body).toMatchObject({
      adjustments: [
        { usage: 'RESIDENTIAL', stratum: 1, percent: null, amount: -12000, base: 'FIXED_CHARGE' },
        { usage: 'RESIDENTIAL', stratum: 2, percent: -50, base: 'FIXED_CHARGE' },
        {
          usage: 'RESIDENTIAL',
          stratum: 3,
          percent: -15,
          base: 'FIXED_CHARGE_AND_BASIC_CONSUMPTION',
        },
      ],
      invoiceDiscounts: [{ usage: 'RESIDENTIAL', stratum: 2, percent: 10 }],
    });
    request.flush(tariff());
  });

  it('con perfil regulado no ofrece ni copia el subsidio sobre el total', async () => {
    await open(
      [tariff({ invoiceDiscounts: [{ usage: 'RESIDENTIAL', stratum: 2, percent: 10 }] })],
      'WATER',
      false,
    );

    expect(textOf(element)).not.toContain('Agregar subsidio sobre el total');
    expect(textOf(element)).toContain('el perfil regulatorio ya no lo permite');
    await submit();

    expect(context.http.expectOne(TARIFFS_URL).request.body.invoiceDiscounts).toEqual([]);
  });

  it('avisa al guardar si una contribución queda por debajo del mínimo', async () => {
    await open([tariff()]);

    await submit();
    context.http.expectOne(TARIFFS_URL).flush(
      tariff({
        contributionWarnings: [
          { usage: 'COMMERCIAL', stratum: null, percent: 20, minimum: 50 },
          { usage: 'INDUSTRIAL', stratum: null, percent: 0, minimum: 30 },
        ],
      }),
    );
    await settle();

    expect(document.body.textContent).toContain(
      'Atención: 2 contribución(es) por debajo del mínimo del perfil regulatorio',
    );
  });

  it('un servicio sin medidor no pregunta qué cubre el subsidio', async () => {
    await open([tariff({ serviceType: 'SANITATION', blocks: [] })], 'SANITATION');

    expect(element.querySelectorAll('mat-select[formcontrolname=base]')).toHaveLength(0);
    await submit();
    expect(context.http.expectOne(TARIFFS_URL).request.body.adjustments[0]).toEqual({
      usage: 'RESIDENTIAL',
      stratum: 1,
      percent: -50,
      base: 'FIXED_CHARGE_AND_BASIC_CONSUMPTION',
    });
  });

  it('un porcentaje no pasa de 100, un valor en pesos sí', async () => {
    await open([]);

    actions.addAdjustment();
    await settle();
    const adjustment = (
      fixture.componentInstance as unknown as {
        adjustments: { at: (i: number) => { patchValue: (v: object) => void } };
      }
    ).adjustments.at(0);
    adjustment.patchValue({ kind: 'SUBSIDY', value: 150 });
    await submit();
    expect(textOf(element)).toContain('El porcentaje no puede pasar de 100');
    context.http.expectNone(TARIFFS_URL);

    adjustment.patchValue({ kind: 'SUBSIDY_AMOUNT', value: 5000 });
    await submit();
    expect(context.http.expectOne(TARIFFS_URL).request.body.adjustments).toEqual([
      {
        usage: 'RESIDENTIAL',
        stratum: 1,
        percent: null,
        amount: -5000,
        base: 'FIXED_CHARGE_AND_BASIC_CONSUMPTION',
      },
    ]);
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
