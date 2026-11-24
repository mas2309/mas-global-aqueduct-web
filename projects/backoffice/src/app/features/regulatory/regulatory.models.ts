/** Contratos de /api/v1/regulatory-profile (módulo tenancy del backend). */

export type RegulatoryFramework = 'NONE' | 'SMALL_PROVIDERS' | 'LARGE_PROVIDERS';

export type AltitudeBand = 'ABOVE_2000' | 'BETWEEN_1000_AND_2000' | 'BELOW_1000';

export type StratificationSource =
  'MUNICIPAL_DECREE' | 'OWN_DESPITE_DECREE' | 'OWN_WITHOUT_DECREE' | 'FLAT_RATE';

/** Condiciones al 31 de diciembre de 2024 con las que la CRA 1038 de 2026 clasifica al prestador. */
export interface Census {
  waterSubscribers: number;
  sewerageSubscribers: number;
  ruralMajority: boolean;
  onlyRural: boolean;
  communityManager: boolean;
  communityInFirstSegment: boolean;
}

/** Un consumo es una desviación si se aleja de su promedio más que el porcentaje que le corresponde. */
export interface DeviationRule {
  threshold: number;
  percentAtOrAbove: number;
  percentBelow: number;
  historyMonths: number;
  /** La factura no se emite hasta revisar la desviación; si es `false` solo se marca. */
  reviewRequired: boolean;
}

export interface RegulatoryRules {
  basicConsumption: number | null;
  /** Porcentaje máximo de subsidio por estrato; un estrato sin entrada no tiene tope. */
  subsidyCaps: Record<string, number>;
  deviation: DeviationRule;
  minDeliveryDaysBeforeDue: number | null;
  legalInvoiceContent: boolean;
  reportsToSui: boolean;
}

export interface Classification {
  segment: 'FIRST' | 'SECOND';
  subsegment: number;
  regime: string;
}

export interface RegulatoryProfile {
  framework: RegulatoryFramework;
  /** Metodología tarifaria vigente hoy; `null` sin marco regulatorio. */
  methodology: string | null;
  altitudeBand: AltitudeBand | null;
  stratificationSource: StratificationSource | null;
  census: Census | null;
  classification: Classification | null;
  rules: RegulatoryRules;
  preset: RegulatoryRules;
  /** Reglas que el prestador ajustó respecto a `preset`. */
  customizedRules: string[];
  /** La plataforma le activó las áreas de prestación aunque no tenga marco. */
  serviceAreasEnabled: boolean;
  /** Trabaja con áreas: tiene marco regulado o se le activaron. */
  usesServiceAreas: boolean;
}

export interface RegulatoryProfileRequest {
  framework: RegulatoryFramework;
  altitudeBand: AltitudeBand | null;
  stratificationSource: StratificationSource | null;
  census: Census | null;
  rules: RegulatoryRules;
  serviceAreasEnabled: boolean;
}

export const REGULATORY_PROFILE_URL = '/api/v1/regulatory-profile';

export const SEGMENT_LABELS: Record<Classification['segment'], string> = {
  FIRST: 'primero',
  SECOND: 'segundo',
};

export const FRAMEWORKS: readonly RegulatoryFramework[] = [
  'NONE',
  'SMALL_PROVIDERS',
  'LARGE_PROVIDERS',
];

export const FRAMEWORK_LABELS: Record<RegulatoryFramework, string> = {
  NONE: 'Sin régimen (reglas propias)',
  SMALL_PROVIDERS: 'Pequeños prestadores (CRA 825 y 1038)',
  LARGE_PROVIDERS: 'Más de 5.000 suscriptores (CRA 688)',
};

export const ALTITUDE_BANDS: readonly AltitudeBand[] = [
  'ABOVE_2000',
  'BETWEEN_1000_AND_2000',
  'BELOW_1000',
];

export const ALTITUDE_LABELS: Record<AltitudeBand, string> = {
  ABOVE_2000: 'Más de 2.000 m s. n. m.',
  BETWEEN_1000_AND_2000: 'Entre 1.000 y 2.000 m s. n. m.',
  BELOW_1000: 'Menos de 1.000 m s. n. m.',
};

export const STRATIFICATION_SOURCES: readonly StratificationSource[] = [
  'MUNICIPAL_DECREE',
  'OWN_DESPITE_DECREE',
  'OWN_WITHOUT_DECREE',
  'FLAT_RATE',
];

export const STRATIFICATION_LABELS: Record<StratificationSource, string> = {
  MUNICIPAL_DECREE: 'Decreto de la alcaldía',
  OWN_DESPITE_DECREE: 'Estratificación propia, aunque hay decreto',
  OWN_WITHOUT_DECREE: 'Estratificación propia, sin decreto',
  FLAT_RATE: 'Tarifa única',
};
