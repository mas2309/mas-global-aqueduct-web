/** Contratos de /api/v1/public/portal (módulo portal del backend). */

export type ServiceType = 'WATER' | 'SEWERAGE' | 'SANITATION' | 'NATURAL_GAS' | 'ELECTRICITY';

/** `OVERDUE`: pendiente y vencida. `CARRIED`: su total pasó como deuda anterior a la factura siguiente. */
export type InvoiceState = 'PENDING' | 'OVERDUE' | 'CARRIED' | 'PAID';

export interface PortalInvoice {
  id: string;
  number: number;
  year: number;
  month: number;
  serviceType: ServiceType;
  consumption: number;
  total: number;
  dueDate: string;
  state: InvoiceState;
  paidAt: string | null;
}

export interface PortalStatement {
  organizationName: string;
  subscriberCode: number;
  subscriberName: string;
  /** De la más reciente a la más antigua. */
  invoices: PortalInvoice[];
}

export const SERVICE_LABELS: Record<ServiceType, string> = {
  WATER: 'Acueducto',
  SEWERAGE: 'Alcantarillado',
  SANITATION: 'Aseo',
  NATURAL_GAS: 'Gas natural',
  ELECTRICITY: 'Energía',
};

export const STATE_LABELS: Record<InvoiceState, string> = {
  PENDING: 'Por pagar',
  OVERDUE: 'Vencida',
  CARRIED: 'Incluida en la siguiente',
  PAID: 'Pagada',
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

export function periodLabel(invoice: PortalInvoice): string {
  return `${MONTHS[invoice.month - 1]} ${invoice.year}`;
}

/** Unidad de consumo; `null` en los servicios sin medidor, que solo pagan cargo fijo. */
export function unitOf(service: ServiceType): string | null {
  switch (service) {
    case 'WATER':
    case 'NATURAL_GAS':
      return 'm³';
    case 'ELECTRICITY':
      return 'kWh';
    default:
      return null;
  }
}

/** La factura se puede pagar: pendiente o vencida (las incluidas en la siguiente se pagan con esa). */
export function isPayable(invoice: PortalInvoice): boolean {
  return invoice.state === 'PENDING' || invoice.state === 'OVERDUE';
}
