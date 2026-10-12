import { CurrencyPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { InstallmentPlan, PLAN_STATUS_LABELS } from '../invoice.models';
import { InvoicesApi, PLANS_URL } from '../invoices-api';
import { PlanDialog } from '../plan-dialog/plan-dialog';

/**
 * Financiaciones de un suscriptor (matrícula, medidor, acuerdos de pago): cada factura cobra una cuota hasta
 * terminar. Se muestra en la ficha del suscriptor.
 */
@Component({
  selector: 'aq-installment-plans',
  imports: [CurrencyPipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './installment-plans.html',
  styleUrl: './installment-plans.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallmentPlans {
  private readonly api = inject(InvoicesApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);

  readonly subscriberId = input.required<string>();
  /** El rol permite crear y cancelar, y el suscriptor está activo. */
  readonly editable = input(false);

  protected readonly plans = httpResource<InstallmentPlan[]>(() => ({
    url: PLANS_URL,
    params: { subscriberId: this.subscriberId() },
  }));
  protected readonly statusLabels = PLAN_STATUS_LABELS;

  protected add(): void {
    this.dialog
      .open<PlanDialog, string, InstallmentPlan>(PlanDialog, {
        data: this.subscriberId(),
        width: '480px',
      })
      .afterClosed()
      .subscribe((created) => {
        if (created) {
          this.plans.reload();
          this.notifier.success('Financiación creada: la primera cuota va en la próxima factura');
        }
      });
  }

  protected cancel(plan: InstallmentPlan): void {
    const data: ConfirmDialogData = {
      title: `Cancelar «${plan.description}»`,
      message: 'Deja de cobrarse en las próximas facturas. Las cuotas ya facturadas no cambian.',
      confirmLabel: 'Cancelar financiación',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.api.cancelPlan(plan.id)),
      )
      .subscribe({
        next: () => {
          this.plans.reload();
          this.notifier.success('Financiación cancelada');
        },
        error: (error: unknown) =>
          this.notifier.apiError(error, {
            403: 'Tu rol solo permite consultar.',
            409: 'Esta financiación ya no está activa.',
          }),
      });
  }
}
