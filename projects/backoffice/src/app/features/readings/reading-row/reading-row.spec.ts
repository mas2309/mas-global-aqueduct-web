import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PERIOD_ID, reading, READING_ID, routeEntry } from '../../../../testing/billing-fixtures';
import { PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { PROPERTY_ID } from '../../../../testing/subscriber-fixtures';
import { Reading, RouteEntry } from '../reading.models';
import { PERIODS_URL, READINGS_URL } from '../readings-api';
import { ReadingRow } from './reading-row';

const RECORD_URL = `${PERIODS_URL}/${PERIOD_ID}/readings`;
const CURRENT = 'input[aria-label^="Lectura actual"]';
const INITIAL = 'input[aria-label^="Lectura anterior"]';

describe('ReadingRow', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<ReadingRow>;
  let element: HTMLElement;
  let changed: (Reading | null)[];

  afterEach(() => context.http.verify());

  async function render(entry: RouteEntry, editable = true): Promise<void> {
    context = setUpPage();
    fixture = TestBed.createComponent(ReadingRow);
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('periodId', PERIOD_ID);
    fixture.componentRef.setInput('serviceType', 'WATER');
    fixture.componentRef.setInput('editable', editable);
    element = fixture.nativeElement;
    changed = [];
    fixture.componentInstance.changed.subscribe((value) => changed.push(value));
    await settle();
  }

  function button(label: string): HTMLButtonElement {
    const found = [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) =>
        textOf(candidate).includes(label) ||
        (candidate.getAttribute('aria-label') ?? '').startsWith(label),
    );
    if (!found) {
      throw new Error(`Button not found: ${label}`);
    }
    return found;
  }

  async function enter(selector: string, value: string): Promise<void> {
    type(element, selector, value);
    await settle();
  }

  it('guarda la lectura con el botón y muestra lo pendiente', async () => {
    await render(routeEntry());

    expect(textOf(element)).toContain('000042 María Gómez');
    expect(textOf(element)).toContain('Medidor MED-001');
    expect(textOf(element)).toContain('Anterior120');
    expect(textOf(element)).toContain('Pendiente');
    expect(button('Guardar').disabled).toBe(true);

    await enter(CURRENT, '135');
    button('Guardar').click();
    const request = context.http.expectOne(RECORD_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      propertyId: PROPERTY_ID,
      serviceType: 'WATER',
      currentReading: 135,
    });
    request.flush(reading());

    expect(changed).toEqual([reading()]);
  });

  it('guarda con Enter', async () => {
    await render(routeEntry());

    await enter(CURRENT, '135');
    element.querySelector(CURRENT)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    context.http.expectOne(RECORD_URL).flush(reading());
    expect(changed).toHaveLength(1);
  });

  it('no envía una lectura menor que la anterior ni una vacía', async () => {
    await render(routeEntry());

    await enter(CURRENT, '');
    element.querySelector(CURRENT)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await enter(CURRENT, '100');
    button('Guardar').click();
    await settle();

    expect(textOf(element)).toContain('La lectura no puede ser menor que la anterior (120)');
    context.http.expectNone(RECORD_URL);
  });

  it('pide la lectura inicial la primera vez que se lee el predio', async () => {
    await render(routeEntry({ previousReading: null, meterSerial: null, sector: null }));

    expect(textOf(element)).toContain('Sin medidor');
    await enter(INITIAL, '50');
    await enter(CURRENT, '60');
    button('Guardar').click();

    const request = context.http.expectOne(RECORD_URL);
    expect(request.request.body).toMatchObject({ currentReading: 60, previousReading: 50 });
    request.flush(reading({ previousReading: 50, currentReading: 60, consumption: 10 }));
  });

  it('registra el cambio de medidor con su lectura inicial', async () => {
    await render(routeEntry());

    button('Cambio de medidor').click();
    await settle();
    expect(textOf(element)).toContain('Inicial medidor nuevo');
    await enter(CURRENT, '5');
    button('Guardar').click();

    const request = context.http.expectOne(RECORD_URL);
    expect(request.request.body).toMatchObject({
      currentReading: 5,
      previousReading: 0,
      meterReplaced: true,
    });
    request.flush(reading({ previousReading: 0, currentReading: 5, meterReplaced: true }));
  });

  it('resalta el consumo inusual y permite eliminar la lectura', async () => {
    await render(
      routeEntry({ reading: reading({ consumption: 40, unusual: true, meterReplaced: true }) }),
    );

    expect(textOf(element)).toContain('40 m³');
    expect(textOf(element)).toContain('Medidor nuevo');
    expect(element.querySelector('[aria-label="Consumo inusual"]')).not.toBeNull();

    button('Eliminar lectura').click();
    const request = context.http.expectOne(`${READINGS_URL}/${READING_ID}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    expect(changed).toEqual([null]);
  });

  it('muestra el rechazo del servidor en la misma fila', async () => {
    await render(routeEntry({ reading: reading() }));

    expect(element.querySelector('[aria-label="Lectura guardada"]')).not.toBeNull();
    await enter(CURRENT, '140');
    button('Guardar').click();
    context.http
      .expectOne(RECORD_URL)
      .flush({ status: 403 }, { status: 403, statusText: 'Forbidden' });
    await settle();
    expect(textOf(element)).toContain('Tu rol solo permite consultar');

    button('Eliminar lectura').click();
    context.http
      .expectOne(`${READINGS_URL}/${READING_ID}`)
      .flush({ status: 422 }, { status: 422, statusText: 'Unprocessable' });
    await settle();
    expect(textOf(element)).toContain('El periodo ya está cerrado');
    expect(changed).toEqual([]);
  });

  it('en un periodo cerrado solo muestra los valores', async () => {
    await render(routeEntry({ reading: reading() }), false);

    expect(element.querySelector('input')).toBeNull();
    expect(element.querySelector('button')).toBeNull();
    expect(textOf(element)).toContain('Anterior120');
    expect(textOf(element)).toContain('Actual135');
    expect(textOf(element)).toContain('15 m³');
  });
});
