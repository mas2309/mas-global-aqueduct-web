import { TestBed } from '@angular/core/testing';
import { authResponse, user } from '../../../../testing/fixtures';
import { PageTestContext, settle, setUpPage, textOf } from '../../../../testing/setup';
import { ORGANIZATIONS_URL } from '../../organizations/organizations-api';
import { REGULATORY_PROFILE_URL, RegulatoryProfile, RegulatoryRules } from '../regulatory.models';
import { RegulatoryProfilePage } from './regulatory-profile';

const ID = 'org-1';
const PROFILE_URL = `${ORGANIZATIONS_URL}/${ID}/regulatory-profile`;

const FREE_RULES: RegulatoryRules = {
  basicConsumption: null,
  subsidyCaps: {},
  deviation: {
    threshold: 40,
    percentAtOrAbove: 35,
    percentBelow: 65,
    historyMonths: 6,
    reviewRequired: false,
  },
  minDeliveryDaysBeforeDue: null,
  legalInvoiceContent: false,
  reportsToSui: false,
};

const FREE_PROFILE: RegulatoryProfile = {
  framework: 'NONE',
  methodology: null,
  altitudeBand: null,
  stratificationSource: null,
  census: null,
  classification: null,
  rules: FREE_RULES,
  preset: FREE_RULES,
  customizedRules: [],
};

describe('RegulatoryProfilePage', () => {
  let context: PageTestContext;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function open(): Promise<RegulatoryProfilePage> {
    context = setUpPage({
      session: authResponse({
        user: user({ platformAdmin: true }),
        organization: null,
        organizations: [],
      }),
    });
    const fixture = TestBed.createComponent(RegulatoryProfilePage);
    fixture.componentRef.setInput('id', ID);
    element = fixture.nativeElement;
    await settle();
    context.http.expectOne(PROFILE_URL).flush(FREE_PROFILE);
    await settle();
    return fixture.componentInstance;
  }

  it('la plataforma guarda el perfil del prestador enviando todas las reglas', async () => {
    const page = await open();

    expect(textOf(element)).toContain('Perfil regulatorio');
    page['form'].controls.stratificationSource.setValue('MUNICIPAL_DECREE');
    page['form'].controls.rules.controls.deviation.controls.percentBelow.setValue(100);
    page['form'].controls.rules.controls.caps.controls.s1.setValue(70);
    page['submit']();

    const request = context.http.expectOne(PROFILE_URL);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      framework: 'NONE',
      altitudeBand: null,
      stratificationSource: 'MUNICIPAL_DECREE',
      census: null,
      rules: {
        ...FREE_RULES,
        subsidyCaps: { '1': 70 },
        deviation: { ...FREE_RULES.deviation, percentBelow: 100 },
      },
    });
    request.flush({
      ...FREE_PROFILE,
      framework: 'LARGE_PROVIDERS',
      stratificationSource: 'MUNICIPAL_DECREE',
    });
    await settle();
    expect(document.body.textContent).toContain('Perfil regulatorio guardado');
  });

  it('propone los valores por defecto del marco elegido', async () => {
    const page = await open();

    page['form'].controls.framework.setValue('LARGE_PROVIDERS');
    page['form'].controls.altitudeBand.setValue('ABOVE_2000');
    page['applyPreset']();

    const request = context.http.expectOne(
      (candidate) =>
        candidate.url === `${REGULATORY_PROFILE_URL}/presets` &&
        candidate.params.get('framework') === 'LARGE_PROVIDERS' &&
        candidate.params.get('altitudeBand') === 'ABOVE_2000',
    );
    request.flush({
      ...FREE_RULES,
      basicConsumption: 11,
      subsidyCaps: { '1': 70, '2': 40 },
      deviation: { ...FREE_RULES.deviation, reviewRequired: true },
    });
    await settle();

    const rules = page['form'].controls.rules.getRawValue();
    expect(rules.basicConsumption).toBe(11);
    expect(rules.caps.s2).toBe(40);
    expect(rules.deviation.reviewRequired).toBe(true);
  });
});
