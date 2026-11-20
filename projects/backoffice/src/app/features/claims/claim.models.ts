/** Contratos de /api/v1/claims (módulo claims del backend). */

export const CLAIMS_URL = '/api/v1/claims';

/** `POSITIVE_SILENCE`: no se respondió a tiempo, se entiende resuelta a favor del suscriptor. */
export type ClaimState = 'OPEN' | 'ANSWERED' | 'POSITIVE_SILENCE';
export type ClaimType = 'PETITION' | 'COMPLAINT' | 'CLAIM';
export type ClaimChannel = 'IN_PERSON' | 'PHONE' | 'WRITTEN' | 'EMAIL' | 'WEB';
export type ClaimDecision = 'FAVORABLE' | 'PARTIAL' | 'UNFAVORABLE';

export interface ClaimAttachment {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export interface Claim {
  id: string;
  number: number;
  state: ClaimState;
  /** Días hábiles para responder; negativo si venció. */
  businessDaysLeft: number;
  subscriberId: string;
  subscriberCode: number;
  subscriberName: string;
  propertyId: string | null;
  invoiceId: string | null;
  type: ClaimType;
  channel: ClaimChannel;
  cause: string;
  causeCode: string | null;
  description: string;
  /** Valor congelado de la factura mientras se resuelve. */
  disputedAmount: number;
  filedOn: string;
  dueDate: string;
  decision: ClaimDecision | null;
  answer: string | null;
  /** Lo que el suscriptor debe de lo congelado. */
  owedAmount: number | null;
  answeredOn: string | null;
  notificationChannel: ClaimChannel | null;
  notifiedOn: string | null;
  attachments: ClaimAttachment[];
}

export interface NewClaim {
  subscriberId: string;
  propertyId: string | null;
  invoiceId: string | null;
  type: ClaimType;
  channel: ClaimChannel;
  cause: string;
  causeCode: string | null;
  description: string;
  disputedAmount: number | null;
  filedOn: string | null;
}

export const CLAIM_STATES: readonly ClaimState[] = ['OPEN', 'ANSWERED', 'POSITIVE_SILENCE'];
export const CLAIM_TYPES: readonly ClaimType[] = ['PETITION', 'COMPLAINT', 'CLAIM'];
export const CLAIM_CHANNELS: readonly ClaimChannel[] = [
  'IN_PERSON',
  'PHONE',
  'WRITTEN',
  'EMAIL',
  'WEB',
];
export const CLAIM_DECISIONS: readonly ClaimDecision[] = ['FAVORABLE', 'PARTIAL', 'UNFAVORABLE'];

export const CLAIM_STATE_LABELS: Record<ClaimState, string> = {
  OPEN: 'Abierta',
  ANSWERED: 'Respondida',
  POSITIVE_SILENCE: 'Silencio positivo',
};

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  PETITION: 'Petición',
  COMPLAINT: 'Queja',
  CLAIM: 'Reclamo',
};

export const CLAIM_CHANNEL_LABELS: Record<ClaimChannel, string> = {
  IN_PERSON: 'Presencial',
  PHONE: 'Teléfono',
  WRITTEN: 'Escrito',
  EMAIL: 'Correo',
  WEB: 'Web',
};

export const CLAIM_DECISION_LABELS: Record<ClaimDecision, string> = {
  FAVORABLE: 'Favorable al suscriptor',
  PARTIAL: 'Parcial',
  UNFAVORABLE: 'Desfavorable al suscriptor',
};

/** «Quedan 3 días hábiles», «Vence hoy» o «Vencida hace 2 días hábiles». */
export function deadlineLabel(claim: Pick<Claim, 'businessDaysLeft'>): string {
  const days = claim.businessDaysLeft;
  if (days === 0) {
    return 'Vence hoy';
  }
  const unit = Math.abs(days) === 1 ? 'día hábil' : 'días hábiles';
  return days > 0 ? `Quedan ${days} ${unit}` : `Vencida hace ${-days} ${unit}`;
}

/** La sigue contando el plazo: las respondidas y en silencio positivo ya no. */
export function isPending(claim: Pick<Claim, 'state'>): boolean {
  return claim.state === 'OPEN';
}
