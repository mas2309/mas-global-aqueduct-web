import { CurrencyPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session-store';
import { formatCode } from '../../subscribers/subscriber.models';
import {
  PLAN_STATUS_LABELS,
  PlanOverview as Overview,
  PlanStatus,
  PlanSummary,
} from '../invoice.models';
import { PLANS_URL } from '../invoices-api';

type StatusFilter = PlanStatus | 'ALL';

/**
 * Todas las financiaciones del prestador: cuántas hay activas, cuánto falta por cobrar y el avance de cada
 * una. Se crean y cancelan desde la ficha del suscriptor.
 */
@Component({
  selector: 'aq-plan-overview',
  imports: [
    CurrencyPipe,
    RouterLink,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './plan-overview.html',
  styleUrl: './plan-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanOverview {
  private readonly session = inject(SessionStore);

  protected readonly status = signal<StatusFilter>('ACTIVE');
  /** Texto en el cuadro de búsqueda; se aplica al enviar, no en cada tecla. */
  protected readonly searchText = signal('');
  protected readonly query = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);

  /** Se vuelve a consultar sola al cambiar el filtro, la página o el prestador de la sesión. */
  protected readonly overview = httpResource<Overview>(() => {
    const organizationId = this.session.organization()?.organizationId;
    if (!organizationId) {
      return undefined;
    }
    const params: Record<string, string | number> = {
      page: this.pageIndex(),
      size: this.pageSize(),
    };
    const status = this.status();
    if (status !== 'ALL') {
      params['status'] = status;
    }
    if (this.query()) {
      params['q'] = this.query();
    }
    return { url: `${PLANS_URL}/overview`, params };
  });

  protected readonly columns = [
    'subscriber',
    'description',
    'total',
    'progress',
    'pending',
    'status',
  ];

  // Las filas de mat-table no tienen tipo: estos métodos conservan el tipado estricto
  protected subscriberOf(row: PlanSummary): string {
    return `${formatCode(row.subscriberCode)} · ${row.subscriberName}`;
  }

  protected statusOf(row: PlanSummary): string {
    return PLAN_STATUS_LABELS[row.plan.status];
  }

  protected percentOf(row: PlanSummary): number {
    return Math.round((row.plan.billed / row.plan.installments) * 100);
  }

  protected filterBy(status: StatusFilter): void {
    this.pageIndex.set(0);
    this.status.set(status);
  }

  protected search(): void {
    this.pageIndex.set(0);
    this.query.set(this.searchText().trim());
  }

  protected clear(): void {
    this.searchText.set('');
    this.search();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
}
