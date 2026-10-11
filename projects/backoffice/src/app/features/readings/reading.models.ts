import { ServiceType } from '../organizations/organization.models';

/** Contratos de /api/v1/billing-periods y /api/v1/readings (módulo metering del backend). */

export type PeriodStatus = 'OPEN' | 'CLOSED';

/** Periodo mensual de facturación. Las lecturas se registran mientras está abierto. */
export interface BillingPeriod {
  id: string;
  year: number;
  month: number;
  status: PeriodStatus;
  openedAt: string;
  closedAt: string | null;
}

export interface Reading {
  id: string;
  propertyId: string;
  serviceType: ServiceType;
  previousReading: number;
  currentReading: number;
  consumption: number;
  /** El medidor se cambió en este periodo: `previousReading` es la lectura inicial del nuevo. */
  meterReplaced: boolean;
  /** El consumo supera el doble del promedio reciente del predio (posible fuga o error de lectura). */
  unusual: boolean;
  notes: string | null;
  readAt: string;
}

/** Una fila de la ruta de lectura: un medidor por leer. */
export interface RouteEntry {
  propertyId: string;
  subscriberId: string;
  subscriberCode: number;
  subscriberName: string;
  address: string;
  sector: string | null;
  meterSerial: string | null;
  connectionStatus: 'ACTIVE' | 'SUSPENDED';
  /** Lectura del periodo anterior; `null` si el predio nunca se ha leído. */
  previousReading: number | null;
  /** Lectura de este periodo; `null` si está pendiente. */
  reading: Reading | null;
}

export interface ReadingRequest {
  propertyId: string;
  serviceType: ServiceType;
  currentReading: number;
  /** Solo para la primera lectura del predio o cuando se cambió el medidor. */
  previousReading?: number;
  meterReplaced?: boolean;
}

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const MONTH_OPTIONS = MONTHS.map((name, index) => ({ value: index + 1, name }));

/** «Octubre 2026». */
export function periodLabel(period: Pick<BillingPeriod, 'year' | 'month'>): string {
  return `${MONTHS[period.month - 1]} ${period.year}`;
}

/** El mes siguiente a un periodo: los periodos son consecutivos. */
export function nextPeriod(period: Pick<BillingPeriod, 'year' | 'month'>): {
  year: number;
  month: number;
} {
  return period.month === 12
    ? { year: period.year + 1, month: 1 }
    : { year: period.year, month: period.month + 1 };
}
