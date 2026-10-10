import { OrganizationRole } from '../auth/auth.models';
import {
  OrganizationStatus,
  OrganizationType,
  ServiceType,
} from '../../features/organizations/organization.models';

/** Textos en español de los valores que llegan del backend. */

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  ORG_ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  VIEWER: 'Consulta',
};

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  COMMUNITY_AQUEDUCT: 'Acueducto comunitario',
  PUBLIC_UTILITY_COMPANY: 'Empresa de servicios públicos',
  MUNICIPALITY: 'Municipio',
};

export const ORGANIZATION_STATUS_LABELS: Record<OrganizationStatus, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  WATER: 'Acueducto',
  SEWERAGE: 'Alcantarillado',
  SANITATION: 'Aseo',
  NATURAL_GAS: 'Gas natural',
  ELECTRICITY: 'Energía',
};

/** Íconos de Material Symbols por servicio. */
export const SERVICE_ICONS: Record<ServiceType, string> = {
  WATER: 'water_drop',
  SEWERAGE: 'plumbing',
  SANITATION: 'delete',
  NATURAL_GAS: 'local_fire_department',
  ELECTRICITY: 'bolt',
};
