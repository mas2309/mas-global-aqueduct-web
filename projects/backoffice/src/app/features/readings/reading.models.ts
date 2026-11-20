import { ServiceType } from '../organizations/organization.models';

/** Contratos de /api/v1/billing-periods y /api/v1/readings (módulo metering del backend). */

export type PeriodStatus = 'OPEN' | 'CLOSED';

/** `PENDING`: tiene una desviación y espera revisión, así que aún no se factura. */
export type ReviewStatus = 'NONE' | 'PENDING' | 'RESOLVED';

/** Qué se decidió al revisar: la lectura es correcta, se corrige o se factura el promedio. */
export type ReviewOutcome = 'CONFIRM' | 'CORRECT' | 'ESTIMATE';

/** Periodo de facturación. Las lecturas se registran mientras está abierto. */
export interface BillingPeriod {
  id: string;
  year: number;
  /** Primer mes del periodo. */
  month: number;
  /** Meses que cubre: 1 si es mensual, 2 si es bimestral... */
  months: number;
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
  /** El consumo se aleja de su promedio más de lo que permite el perfil regulatorio del prestador. */
  unusual: boolean;
  /** El consumo es un promedio porque no se pudo medir. */
  estimated: boolean;
  reviewStatus: ReviewStatus;
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
  connectionStatus: 'ACTIVE' | 'SUSPENDED' | 'CUT';
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

export interface ReviewRequest {
  outcome: ReviewOutcome;
  /** Solo si se corrige la lectura. */
  currentReading?: number;
  /** Qué se encontró al revisar. */
  notes: string;
}

export const REVIEW_OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  CONFIRM: 'La lectura es correcta',
  CORRECT: 'La lectura estaba mal tomada',
  ESTIMATE: 'No se pudo establecer el consumo: facturar el promedio',
};

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

/** Opciones de periodicidad: el backend admite de 1 a 12 meses. */
export const PERIODICITY_OPTIONS = [
  { value: 1, name: 'Mensual' },
  { value: 2, name: 'Bimestral' },
  { value: 3, name: 'Trimestral' },
  { value: 6, name: 'Semestral' },
];

type PeriodMonths = Pick<BillingPeriod, 'year' | 'month'> & Partial<Pick<BillingPeriod, 'months'>>;

/** «Octubre 2026» o, si cubre varios meses, «Octubre a Noviembre 2026». */
export function periodLabel(period: PeriodMonths): string {
  const first = `${MONTHS[period.month - 1]} ${period.year}`;
  const months = period.months ?? 1;
  if (months <= 1) {
    return first;
  }
  const last = period.month - 1 + months - 1;
  const lastMonth = MONTHS[last % 12];
  const lastYear = period.year + Math.floor(last / 12);
  return lastYear === period.year
    ? `${MONTHS[period.month - 1]} a ${lastMonth} ${period.year}`
    : `${first} a ${lastMonth} ${lastYear}`;
}

/** El periodo que sigue: empieza después del último mes de este y conserva su periodicidad. */
export function nextPeriod(period: PeriodMonths): {
  year: number;
  month: number;
  months: number;
} {
  const months = period.months ?? 1;
  const next = period.month - 1 + months;
  return { year: period.year + Math.floor(next / 12), month: (next % 12) + 1, months };
}
