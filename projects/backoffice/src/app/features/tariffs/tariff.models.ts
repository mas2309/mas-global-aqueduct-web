import { ServiceType } from '../organizations/organization.models';
import { PropertyUsage } from '../subscribers/subscriber.models';

/** Contratos de /api/v1/tariffs (módulo tariffs del backend). */

/** Rango de consumo acumulativo. `upTo` nulo en el último: no tiene límite. */
export interface TariffBlock {
  upTo: number | null;
  pricePerUnit: number;
}

/** Subsidio (porcentaje negativo) o contribución (positivo) para un uso y estrato. */
export interface TariffAdjustment {
  usage: PropertyUsage;
  stratum: number | null;
  percent: number;
}

/** Versión de la tarifa de un servicio, vigente desde una fecha. */
export interface Tariff {
  id: string;
  serviceType: ServiceType;
  /** Área de prestación a la que aplica; sin ella es la tarifa general. */
  serviceAreaId?: string | null;
  /** Fecha ISO `yyyy-MM-dd`. */
  validFrom: string;
  /** Es la versión que se usa hoy para liquidar. */
  inEffect: boolean;
  fixedCharge: number;
  blocks: TariffBlock[];
  adjustments: TariffAdjustment[];
  createdAt: string;
}

export type TariffRequest = Omit<Tariff, 'id' | 'inEffect' | 'createdAt'>;

/** Liquidación de un consumo con la tarifa vigente. */
export interface TariffCharge {
  fixedCharge: number;
  consumptionCharge: number;
  adjustmentPercent: number;
  adjustment: number;
  total: number;
  blocks: { units: number; pricePerUnit: number; amount: number }[];
}

const UNITS: Partial<Record<ServiceType, string>> = { ELECTRICITY: 'kWh' };

/** Unidad en la que se mide el consumo del servicio. */
export function unitOf(service: ServiceType): string {
  return UNITS[service] ?? 'm³';
}

/** Texto de un rango: «0 a 10 m³», «Más de 20 m³». */
export function blockLabel(blocks: TariffBlock[], index: number, unit: string): string {
  const from = index === 0 ? 0 : (blocks[index - 1].upTo ?? 0);
  const upTo = blocks[index].upTo;
  if (upTo === null) {
    return from === 0 ? `Todo el consumo` : `Más de ${from} ${unit}`;
  }
  return `${from === 0 ? 0 : `Más de ${from}`} a ${upTo} ${unit}`;
}
