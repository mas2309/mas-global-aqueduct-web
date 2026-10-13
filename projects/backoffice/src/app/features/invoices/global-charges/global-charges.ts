import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { filter, Observable, switchMap } from 'rxjs';
import { SessionStore } from '../../../core/auth/session-store';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { GlobalChargeDialog } from '../global-charge-dialog/global-charge-dialog';
import { GlobalCharge } from '../invoice.models';
import { GLOBAL_CHARGES_URL, InvoicesApi } from '../invoices-api';

/**
 * Cobros globales: una cuota extraordinaria para todos los suscriptores activos (un aporte para una obra). Cada
 * uno genera una financiación por suscriptor, que se cobra en sus facturas.
 */
@Component({
  selector: 'aq-global-charges',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './global-charges.html',
  styleUrl: './global-charges.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalCharges {
  private readonly api = inject(InvoicesApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Se vuelve a consultar sola al cambiar el prestador de la sesión. */
  protected readonly charges = httpResource<GlobalCharge[]>(() =>
    this.session.organization()?.organizationId ? GLOBAL_CHARGES_URL : undefined,
  );

  /** Porcentaje de cuotas ya facturadas entre todos los suscriptores. */
  protected percentOf(charge: GlobalCharge): number {
    const expected = charge.subscribers * charge.installments;
    return expected === 0 ? 0 : Math.round((charge.billedInstallments / expected) * 100);
  }

  protected create(): void {
    this.dialog
      .open<GlobalChargeDialog, void, GlobalCharge>(GlobalChargeDialog, { width: '480px' })
      .afterClosed()
      .subscribe((created) => {
        if (created) {
          this.charges.reload();
          this.notifier.success(
            `Cobro creado para ${created.subscribers} suscriptores: la primera cuota va en su próxima factura`,
          );
        }
      });
  }

  protected cancel(charge: GlobalCharge): void {
    this.confirm(
      {
        title: `Cancelar «${charge.description}»`,
        message:
          'Deja de cobrarse a quienes aún lo deben. Las cuotas ya facturadas no cambian. No se puede deshacer.',
        confirmLabel: 'Cancelar cobro',
        danger: true,
      },
      this.api.cancelGlobalCharge(charge.id),
      'Cobro global cancelado',
    );
  }

  protected remove(charge: GlobalCharge): void {
    this.confirm(
      {
        title: `Eliminar «${charge.description}»`,
        message: 'Se elimina el cobro y la financiación que se le creó a cada suscriptor.',
        confirmLabel: 'Eliminar cobro',
        danger: true,
      },
      this.api.deleteGlobalCharge(charge.id),
      'Cobro global eliminado',
    );
  }

  private confirm(data: ConfirmDialogData, action: Observable<unknown>, done: string): void {
    this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => action),
      )
      .subscribe({
        next: () => {
          this.charges.reload();
          this.notifier.success(done);
        },
        error: (error: unknown) =>
          this.notifier.apiError(error, {
            403: 'Solo el administrador del prestador gestiona los cobros globales.',
            409: 'Este cobro ya estaba cancelado.',
            422: 'Este cobro ya tiene cuotas facturadas: cancélalo en lugar de eliminarlo.',
          }),
      });
  }
}
