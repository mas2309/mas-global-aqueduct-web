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
