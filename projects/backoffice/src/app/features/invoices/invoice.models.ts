import { Page, ServiceType } from '../organizations/organization.models';

/** Contratos de /api/v1/invoices, /installment-plans y /billing-settings (módulo billing del backend). */

/** `OVERDUE`: pendiente y vencida. `CARRIED`: su total pasó como deuda anterior a la factura siguiente. */
export type InvoiceState = 'PENDING' | 'OVERDUE' | 'CARRIED' | 'PAID';
export type PaymentMethod = 'CASH' | 'BANK';

/** Cuota de una financiación cobrada en la factura: «cuota 3 de 12». */
export interface InvoiceInstallment {
  planId: string;
  description: string;
  number: number;
  count: number;
  amount: number;
}

/** Factura de un servicio de un predio en un periodo. Se genera sola al registrar la lectura. */
export interface Invoice {
  id: string;
  number: number;
  periodId: string;
  year: number;
  month: number;
  readingId: string;
  propertyId: string;
  subscriberId: string;
  subscriberCode: number;
  subscriberName: string;
  address: string;
  serviceType: ServiceType;
  previousReading: number;
  currentReading: number;
  consumption: number;
  fixedCharge: number;
  consumptionCharge: number;
  adjustmentPercent: number;
  /** Subsidio (negativo) o contribución (positivo). */
  adjustment: number;
  /** Total de la factura anterior si no se pagó. */
  previousDebt: number;
  /** Recargo por no haber pagado la factura anterior. */
  lateFee: number;
  otherCharges: number;
  otherChargesDescription: string | null;
  installment: InvoiceInstallment | null;
  total: number;
  /** Fecha ISO `yyyy-MM-dd`. */
  dueDate: string;
  state: InvoiceState;
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
  issuedAt: string;
}

export type PlanStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

/** Financiación de un suscriptor: se cobra una cuota en cada factura. */
export interface InstallmentPlan {
  id: string;
  subscriberId: string;
  description: string;
  totalAmount: number;
  installments: number;
  /** Cuotas ya cobradas en facturas. */
  billed: number;
  installmentAmount: number;
  pendingAmount: number;
  status: PlanStatus;
  createdAt: string;
}

export interface InstallmentPlanRequest {
  subscriberId: string;
  description: string;
  totalAmount: number;
  installments: number;
}

export interface BillingSettings {
  /** Día del mes siguiente al periodo hasta el que se paga sin que la factura quede vencida. */
  paymentDueDay: number;
  /** Recargo que se cobra cuando la factura anterior no se pagó. */
  lateFee: number;
}

export const INVOICE_STATE_LABELS: Record<InvoiceState, string> = {
  PENDING: 'Pendiente',
  OVERDUE: 'Vencida',
  CARRIED: 'Incluida en la siguiente',
  PAID: 'Pagada',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  BANK: 'Banco',
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  ACTIVE: 'Activa',
  COMPLETED: 'Terminada',
  CANCELLED: 'Cancelada',
};

/** Solo la factura más reciente de una acometida, mientras no esté pagada, se puede cobrar o modificar. */
export function isOpen(invoice: Invoice): boolean {
  return invoice.state === 'PENDING' || invoice.state === 'OVERDUE';
}

/** Una financiación en la vista global, con su suscriptor. */
export interface PlanSummary {
  plan: InstallmentPlan;
  subscriberCode: number;
  subscriberName: string;
}

/** Vista global de las financiaciones del prestador. */
export interface PlanOverview {
  activePlans: number;
  /** Lo que falta por facturar entre todas las activas. */
  pendingAmount: number;
  plans: Page<PlanSummary>;
}
