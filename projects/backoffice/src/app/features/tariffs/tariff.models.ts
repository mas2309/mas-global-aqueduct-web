import { ServiceType } from '../organizations/organization.models';
import { PropertyUsage } from '../subscribers/subscriber.models';

/** Contratos de /api/v1/tariffs (módulo tariffs del backend). */

/** Rango de consumo acumulativo. `upTo` nulo en el último: no tiene límite. */
export interface TariffBlock {
  upTo: number | null;
  pricePerUnit: number;
}

/**
 * Qué cubre un subsidio: el cargo fijo y el consumo básico (o todo el consumo si el prestador no tiene básico),
 * o solo el cargo fijo.
 */
export type SubsidyBase = 'FIXED_CHARGE_AND_BASIC_CONSUMPTION' | 'FIXED_CHARGE';

export const SUBSIDY_BASE_LABELS: Record<SubsidyBase, string> = {
  FIXED_CHARGE_AND_BASIC_CONSUMPTION: 'Cargo fijo y consumo básico',
  FIXED_CHARGE: 'Solo el cargo fijo',
};

/**
 * Subsidio o contribución para un uso y estrato. Lleva `percent` (negativo un subsidio, positivo una
 * contribución) o, solo un subsidio, `amount`: pesos al mes en negativo. `base` es lo que cubre el subsidio; en
 * una contribución no se usa.
 */
export interface TariffAdjustment {
  usage: PropertyUsage;
  stratum: number | null;
  percent: number | null;
  amount?: number | null;
  base?: SubsidyBase;
}

/**
 * Segundo subsidio de un uso y estrato: porcentaje (positivo) que se descuenta de toda la factura, incluida la
 * deuda anterior.
 */
export interface InvoiceDiscount {
  usage: PropertyUsage;
  stratum: number | null;
  percent: number;
}

/** Contribución por debajo del mínimo del perfil: `percent` es la que tiene la tarifa (0 si ninguna). */
export interface ContributionWarning {
  usage: PropertyUsage;
  stratum: number | null;
  percent: number;
  minimum: number;
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
  invoiceDiscounts: InvoiceDiscount[];
  /** Usos y estratos que contribuyen menos del mínimo del perfil regulatorio. Es un aviso: la tarifa se guardó. */
  contributionWarnings?: ContributionWarning[];
  createdAt: string;
}

export type TariffRequest = Omit<Tariff, 'id' | 'inEffect' | 'createdAt' | 'contributionWarnings'>;

/** Liquidación de un consumo con la tarifa vigente. */
export interface TariffCharge {
  fixedCharge: number;
  consumptionCharge: number;
  /** En un subsidio en pesos, el porcentaje que resulta. */
  adjustmentPercent: number;
  adjustment: number;
  /** Porcentaje que además se descuenta de toda la factura; 0 si no aplica. */
  invoiceDiscountPercent: number;
  /** Lo del servicio en el periodo, antes del descuento sobre toda la factura. */
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
