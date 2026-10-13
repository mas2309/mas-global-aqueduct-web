import { PaymentMethod } from '../invoices/invoice.models';
import { ServiceType } from '../organizations/organization.models';

/** Contratos de /api/v1/reports (informes del módulo billing del backend). */

export const REPORTS_URL = '/api/v1/reports';

/** Cifras de la pantalla de inicio. */
export interface BillingSummary {
  /** Último periodo facturado; `null` si el prestador aún no tiene facturas. */
  billed: { year: number; month: number; invoices: number; amount: number } | null;
  /** Recaudo del mes calendario en curso. */
  collected: { payments: number; amount: number };
  /** Cartera a hoy; `overdueAmount` es la parte de `amount` ya vencida. */
  outstanding: { invoices: number; subscribers: number; amount: number; overdueAmount: number };
}

/** Un pago recibido: incluye las facturas anteriores que se saldaron con él. */
export interface CollectionEntry {
  invoiceId: string;
  number: number;
  subscriberCode: number;
  subscriberName: string;
  serviceType: ServiceType;
  year: number;
  month: number;
  method: PaymentMethod;
  paidAt: string;
  amount: number;
}

export interface Collections {
  cash: number;
  bank: number;
  total: number;
  /** Del más reciente al más antiguo. */
  payments: CollectionEntry[];
}

/** Fecha local en formato `yyyy-MM-dd`, como la esperan la API y los campos de fecha. */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Un pago que se deshizo, con el motivo que dio quien lo reversó. */
export interface PaymentReversal {
  invoiceId: string;
  number: number;
  method: PaymentMethod;
  /** Cuándo se había registrado el pago. */
  paidAt: string;
  reason: string;
  reversedAt: string;
}

/** Tablero de una ESP o municipio: sus cifras, las de cada prestador vinculado y la suma de todos. */
export interface ConsolidatedSummary {
  own: BillingSummary;
  /** Vacío si el prestador no tiene vinculados. */
  affiliates: { organizationId: string; name: string; summary: BillingSummary }[];
  /** `billed` suma el último periodo facturado de cada prestador, que puede no ser el mismo mes. */
  totals: { billed: number; collected: number; outstanding: number; overdue: number };
}

/** Lo que debe un suscriptor entre todos sus predios y servicios. */
export interface Debtor {
  subscriberId: string;
  subscriberCode: number;
  subscriberName: string;
  invoices: number;
  amount: number;
  /** La parte de `amount` ya vencida. */
  overdueAmount: number;
}

/** Facturas de un periodo cuyo consumo cae en un rango de la tarifa. */
export interface ConsumptionRange {
  from: number;
  /** `null` en el último rango, que no tiene límite. */
  upTo: number | null;
  /** `null` en la fila de facturas sin consumo. */
  pricePerUnit: number | null;
  subscribers: number;
  invoices: number;
  consumption: number;
  /** Valor del consumo facturado a quienes cayeron en el rango. */
  charge: number;
}
