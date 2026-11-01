/** Contratos de /api/v1/platform/settlements (módulo settlements del backend). */

export const SETTLEMENTS_URL = '/api/v1/platform/settlements';

export interface Settlement {
  id: string;
  organizationId: string;
  organizationName: string;
  year: number;
  month: number;
  status: 'DRAFT' | 'ISSUED';
  activeSubscribers: number;
  jointSanitation: boolean;
  suiCharacterization: 'NOT_REPORTING' | 'RURAL' | 'SMALL' | 'LARGE';
  electronicInvoices: number;
  brebPayments: number;
  dispersions: number;
  planCharge: number;
  extraSubscribersCharge: number;
  electronicInvoicesCharge: number;
  brebPaymentsCharge: number;
  dispersionsCharge: number;
  jointSanitationCharge: number;
  suiReportsCharge: number;
  total: number;
  issuedAt: string | null;
}
