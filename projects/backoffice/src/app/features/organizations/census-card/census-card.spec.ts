import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { ORGANIZATIONS_URL } from '../organizations-api';
import { CensusCard } from './census-card';

const ID = 'org-1';
const CENSUS = {
  waterSubscribers: 1200,
  sewerageSubscribers: 900,
  ruralMajority: false,
  onlyRural: false,
  communityManager: false,
  communityInFirstSegment: false,
};
const PROFILE = {
  framework: 'SMALL_PROVIDERS',
  census: CENSUS,
  classification: { segment: 'FIRST', subsegment: 3, regime: 'REGULATED_FREEDOM' },
};

describe('CensusCard', () => {
  let context: PageTestContext;
  let element: HTMLElement;
  let confirmed: boolean;

  beforeEach(() => {
    confirmed = true;
    context = setUpPage({
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirmed) }) } },
      ],
    });
  });

  afterEach(() => context.http.verify());

  async function open(profile: unknown): Promise<void> {
    const fixture = TestBed.createComponent(CensusCard);
    fixture.componentRef.setInput('organizationId', ID);
    element = fixture.nativeElement;
    await settle();
    context.http
      .expectOne(`${ORGANIZATIONS_URL}/${ID}/regulatory-profile`)
      .flush(profile as object);
    await settle();
  }

  function setWater(value: string): void {
    const input = element.querySelector<HTMLInputElement>(
      'input[formcontrolname=waterSubscribers]',
    );
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
  }

  it('sin condiciones registradas no ofrece corregir', async () => {
    await open({ framework: 'NONE', census: null, classification: null });

    expect(textOf(element)).toContain('aún no registró sus condiciones');
    expect(element.querySelector('button')).toBeNull();
  });

  it('corrige las condiciones tras confirmar y muestra la nueva clasificación', async () => {
    await open(PROFILE);
    expect(textOf(element)).toContain('subsegmento 3');

    setWater('1500');
    element.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit'));
    const request = context.http.expectOne(`${ORGANIZATIONS_URL}/${ID}/regulatory-census`);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ ...CENSUS, waterSubscribers: 1500 });
    request.flush({
      ...PROFILE,
      census: { ...CENSUS, waterSubscribers: 1500 },
      classification: { ...PROFILE.classification, subsegment: 2 },
    });
    await settle();

    expect(textOf(element)).toContain('subsegmento 2');
    expect(document.body.textContent).toContain('Condiciones corregidas');
  });

  it('no envía nada si no se confirma', async () => {
    confirmed = false;
    await open(PROFILE);

    element.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit'));
    await settle();

    context.http.expectNone(`${ORGANIZATIONS_URL}/${ID}/regulatory-census`);
  });

  it('explica si las condiciones no corresponden al marco', async () => {
    await open(PROFILE);

    setWater('9000');
    element.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit'));
    context.http
      .expectOne(`${ORGANIZATIONS_URL}/${ID}/regulatory-census`)
      .flush({ status: 400 }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(document.body.textContent).toContain('no corresponden al marco regulatorio');
  });
});
