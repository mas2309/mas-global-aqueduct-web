import { AltitudeBand } from '../regulatory/regulatory.models';

/** Contratos de /api/v1/service-areas (módulo tenancy del backend). */

export const SERVICE_AREAS_URL = '/api/v1/service-areas';

/** Área de prestación: puede tener tarifas propias. Un prestador con una sola área no las registra. */
export interface ServiceArea {
  id: string;
  name: string;
  municipalityCode: string | null;
  /** `null`: usa la altitud del perfil regulatorio. */
  altitudeBand: AltitudeBand | null;
}

export type ServiceAreaRequest = Omit<ServiceArea, 'id'>;
