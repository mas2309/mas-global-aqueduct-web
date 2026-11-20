import { ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { displayName, Organization } from './organization.models';

/** Qué se le pregunta al administrador de plataforma antes de suspender o reactivar un prestador. */
export function statusChangeConfirmation(organization: Organization): ConfirmDialogData {
  return organization.status === 'ACTIVE'
    ? {
        title: 'Suspender prestador',
        message: `${displayName(organization)} no podrá facturar ni recaudar. Sus usuarios seguirán consultando el historial.`,
        confirmLabel: 'Suspender',
        danger: true,
      }
    : {
        title: 'Reactivar prestador',
        message: `${displayName(organization)} volverá a operar normalmente.`,
        confirmLabel: 'Reactivar',
      };
}
