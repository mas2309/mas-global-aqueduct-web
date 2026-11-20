import { ServiceType } from '../organizations/organization.models';
import { ConnectionStatus } from '../subscribers/subscriber.models';

/** Contratos de /api/v1/disconnections (módulo disconnections del backend). */

export const DISCONNECTIONS_URL = '/api/v1/disconnections';

export type ServiceAction = 'SUSPEND' | 'CUT' | 'RECONNECT' | 'REINSTATE';

/** Lo que se le puede pedir al servidor: reconectar o reinstalar lo decide él, según el estado. */
export type RequestedAction = 'SUSPEND' | 'CUT' | 'RESTORE';

export interface DisconnectionRules {
  /** Periodos vencidos sin pagar para sugerir la suspensión; `null`: no se sugiere. */
  suspendAfterUnpaidPeriods: number | null;
  cutAfterUnpaidPeriods: number | null;
  reconnectionFee: number;
  reinstatementFee: number;
  /** Hay que estar al día para restablecer el servicio. */
  paymentRequiredToRestore: boolean;
  causes: string[];
}

/** Acometida que según las reglas debería suspenderse o cortarse. Solo es una sugerencia. */
export interface Candidate {
  propertyId: string;
  propertyCode: number;
  subscriberId: string;
  subscriberCode: number;
  subscriberName: string;
  address: string;
  serviceType: ServiceType;
  status: ConnectionStatus;
  unpaidPeriods: number;
  owed: number;
  action: ServiceAction;
}

export interface ServiceEvent {
  id: string;
  propertyId: string;
  serviceType: ServiceType;
  action: ServiceAction;
  cause: string | null;
  notes: string | null;
  fee: number;
  /** Se restableció con deuda vencida, con autorización de un administrador. */
  overridden: boolean;
  performedBy: string;
  performedAt: string;
}

export const SERVICE_ACTION_LABELS: Record<ServiceAction, string> = {
  SUSPEND: 'Suspensión',
  CUT: 'Corte',
  RECONNECT: 'Reconexión',
  REINSTATE: 'Reinstalación',
};
