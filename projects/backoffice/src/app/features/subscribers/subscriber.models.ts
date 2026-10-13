import { ServiceType } from '../organizations/organization.models';

/** Contratos de /api/v1/subscribers y /api/v1/properties (módulo subscribers del backend). */

export type DocumentType = 'CC' | 'CE' | 'NIT' | 'TI' | 'PASSPORT';

export type SubscriberStatus = 'ACTIVE' | 'INACTIVE';

export interface Subscriber {
  id: string;
  /** Consecutivo dentro del prestador: el número que conocen el fontanero y el usuario. */
  code: number;
  fullName: string;
  documentType: DocumentType | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  status: SubscriberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriberRequest {
  fullName: string;
  documentType: DocumentType | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
}

export type PropertyUsage = 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'OFFICIAL' | 'SPECIAL';

export type ConnectionStatus = 'ACTIVE' | 'SUSPENDED';

/** Acometida: un servicio conectado a un predio. */
export interface PropertyService {
  serviceType: ServiceType;
  meterSerial: string | null;
  status: ConnectionStatus;
  connectedAt: string;
}

export interface Property {
  id: string;
  subscriberId: string;
  address: string;
  sector: string | null;
  usage: PropertyUsage;
  /** Estrato 1 a 6; solo en predios residenciales. */
  stratum: number | null;
  services: PropertyService[];
  createdAt: string;
  updatedAt: string;
}

export interface PropertyRequest {
  address: string;
  sector: string | null;
  usage: PropertyUsage;
  stratum: number | null;
}

export const DOCUMENT_TYPES: readonly DocumentType[] = ['CC', 'CE', 'NIT', 'TI', 'PASSPORT'];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  NIT: 'NIT',
  TI: 'Tarjeta de identidad',
  PASSPORT: 'Pasaporte',
};

export const PROPERTY_USAGES: readonly PropertyUsage[] = [
  'RESIDENTIAL',
  'COMMERCIAL',
  'INDUSTRIAL',
  'OFFICIAL',
  'SPECIAL',
];

export const PROPERTY_USAGE_LABELS: Record<PropertyUsage, string> = {
  RESIDENTIAL: 'Residencial',
  COMMERCIAL: 'Comercial',
  INDUSTRIAL: 'Industrial',
  OFFICIAL: 'Oficial',
  SPECIAL: 'Especial',
};

export const STRATA: readonly number[] = [1, 2, 3, 4, 5, 6];

/** Servicios que se facturan por lectura de medidor (igual que `ServiceType.isMetered` en el backend). */
export const METERED_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>([
  'WATER',
  'NATURAL_GAS',
  'ELECTRICITY',
]);

/** Código con ceros a la izquierda, como se imprime en las facturas: 000042. */
export function formatCode(code: number): string {
  return String(code).padStart(6, '0');
}

/** Enlace del portal público del suscriptor; `null` si el portal no está configurado en el ambiente. */
export interface PortalLink {
  url: string | null;
}
