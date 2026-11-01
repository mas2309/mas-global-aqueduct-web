import { ServiceType } from '../organizations/organization.models';

/** Contratos de /api/v1/sui (módulo sui del backend). */

export const SUI_URL = '/api/v1/sui';

export type SuiFormat = 'USER_CATALOG' | 'REC_PROVIDER';

export type SuiField =
  | 'PROPERTY_CODE'
  | 'MUNICIPALITY_CODE'
  | 'USAGE_CODE'
  | 'STRATUM'
  | 'ADDRESS'
  | 'STATUS_CODE'
  | 'METER_CODE'
  | 'METER_SERIAL'
  | 'PROVIDER_NAME'
  | 'PROVIDER_NIT'
  | 'PROVIDER_CHECK_DIGIT'
  | 'REC_STRATUM_CODE';

export interface SuiColumn {
  header: string;
  field: SuiField;
  /** De qué servicio sale el dato; `null` en los datos del predio. */
  service: ServiceType | null;
}

export interface SuiTemplate {
  format: SuiFormat;
  /** 0 es la que trae la plataforma. */
  version: number;
  columns: SuiColumn[];
  codes: Record<string, string>;
}

export interface SuiIssue {
  propertyCode: number;
  column: string;
  message: string;
}

export interface SuiReview {
  rows: number;
  issues: SuiIssue[];
}

export const SUI_FORMATS: readonly SuiFormat[] = ['USER_CATALOG', 'REC_PROVIDER'];

export const SUI_FORMAT_LABELS: Record<SuiFormat, string> = {
  USER_CATALOG: 'Catastro de usuarios',
  REC_PROVIDER: 'REC para la alcaldía',
};

export const SUI_FIELDS: readonly SuiField[] = [
  'PROPERTY_CODE',
  'MUNICIPALITY_CODE',
  'USAGE_CODE',
  'STRATUM',
  'ADDRESS',
  'STATUS_CODE',
  'METER_CODE',
  'METER_SERIAL',
  'PROVIDER_NAME',
  'PROVIDER_NIT',
  'PROVIDER_CHECK_DIGIT',
  'REC_STRATUM_CODE',
];

export const SUI_FIELD_LABELS: Record<SuiField, string> = {
  PROPERTY_CODE: 'NUIU del predio',
  MUNICIPALITY_CODE: 'Código DANE del municipio',
  USAGE_CODE: 'Código de uso',
  STRATUM: 'Estrato',
  ADDRESS: 'Dirección',
  STATUS_CODE: 'Código de estado',
  METER_CODE: 'Código de medidor',
  METER_SERIAL: 'Número de medidor',
  PROVIDER_NAME: 'Nombre del prestador',
  PROVIDER_NIT: 'NIT del prestador',
  PROVIDER_CHECK_DIGIT: 'Dígito de verificación',
  REC_STRATUM_CODE: 'Estrato del prestador (REC)',
};

/** Validaciones del backend: que no rompan el CSV ni la forma en que se guarda la plantilla. */
export const SUI_HEADER_PATTERN = /^[A-Za-z0-9_ ]{1,60}$/;
export const SUI_CODE_KEY_PATTERN = /^[A-Za-z0-9_.]{1,60}$/;
export const SUI_CODE_VALUE_PATTERN = /^[A-Za-z0-9]{1,10}$/;
