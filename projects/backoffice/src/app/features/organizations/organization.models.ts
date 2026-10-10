/** Contratos de /api/v1/organizations y /api/v1/affiliations (módulo tenancy del backend). */

export type OrganizationType = 'COMMUNITY_AQUEDUCT' | 'PUBLIC_UTILITY_COMPANY' | 'MUNICIPALITY';

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED';

export type ServiceType = 'WATER' | 'SEWERAGE' | 'SANITATION' | 'NATURAL_GAS' | 'ELECTRICITY';

export const SERVICE_TYPES: readonly ServiceType[] = [
  'WATER',
  'SEWERAGE',
  'SANITATION',
  'NATURAL_GAS',
  'ELECTRICITY',
];

export const ORGANIZATION_TYPES: readonly OrganizationType[] = [
  'COMMUNITY_AQUEDUCT',
  'PUBLIC_UTILITY_COMPANY',
  'MUNICIPALITY',
];

/** Solo las ESP y los municipios pueden vincular prestadores (regla del backend). */
export function canAffiliateOthers(type: OrganizationType): boolean {
  return type !== 'COMMUNITY_AQUEDUCT';
}

export interface Organization {
  id: string;
  nit: string;
  legalName: string;
  tradeName: string | null;
  type: OrganizationType;
  status: OrganizationStatus;
  municipalityCode: string;
  email: string | null;
  phone: string | null;
  services: ServiceType[];
  createdAt: string;
  updatedAt: string;
}

export interface RegisterOrganizationRequest {
  nit: string;
  legalName: string;
  tradeName: string | null;
  type: OrganizationType;
  municipalityCode: string;
  email: string | null;
  phone: string | null;
  services: ServiceType[];
}

/** Datos editables. El NIT no cambia; estado y servicios tienen sus propias operaciones. */
export type UpdateOrganizationRequest = Omit<RegisterOrganizationRequest, 'nit' | 'services'>;

export interface Affiliation {
  id: string;
  parentOrganizationId: string;
  childOrganizationId: string;
  status: 'ACTIVE' | 'ENDED';
  startedAt: string;
  endedAt: string | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export function displayName(organization: Pick<Organization, 'legalName' | 'tradeName'>): string {
  return organization.tradeName ?? organization.legalName;
}
