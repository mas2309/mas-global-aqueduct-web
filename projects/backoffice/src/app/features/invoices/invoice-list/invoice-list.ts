import { CurrencyPipe } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session-store';
import { Notifier } from '../../../core/ui/notifier';
import { saveFile } from '../../../shared/ui/save-file';
import { Page } from '../../organizations/organization.models';
import { periodLabel } from '../../readings/reading.models';
import { METERED_SERVICES } from '../../subscribers/subscriber.models';
import { unitOf } from '../../tariffs/tariff.models';
import { BillingSettingsDialog } from '../billing-settings-dialog/billing-settings-dialog';
import { InvoicePayments } from '../invoice-payments';
import {
  BillingSettings,
  Invoice,
  INVOICE_STATE_LABELS,
  InvoiceState,
  isOpen,
  PaymentMethod,
} from '../invoice.models';
import { INVOICES_URL } from '../invoices-api';

type StateFilter = InvoiceState | 'ALL';

/**
 * Facturas del prestador. Nacen de las lecturas: aquí se consultan, se filtran por estado y se registra el
 * recaudo en efectivo o banco.
 */
@Component({
  selector: 'aq-invoice-list',
  imports: [
    CurrencyPipe,
    RouterLink,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './invoice-list.html',
  styleUrl: './invoice-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceList {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly payments = inject(InvoicePayments);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Solo las facturas de un suscriptor (query param `suscriptor`), al llegar desde su ficha. */
  readonly suscriptor = input<string>();

  protected readonly state = signal<StateFilter>('ALL');
  protected readonly year = signal<number | null>(null);
  /** Texto en el cuadro de búsqueda; se aplica al enviar, no en cada tecla (conexiones lentas). */
  protected readonly searchText = signal('');
  protected readonly query = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);

  /** Se vuelve a consultar sola al cambiar un filtro, la página o el prestador de la sesión. */
  protected readonly invoices = httpResource<Page<Invoice>>(() => {
    const organizationId = this.session.organization()?.organizationId;
    if (!organizationId) {
      return undefined;
    }
    const params: Record<string, string | number> = {
      page: this.pageIndex(),
      size: this.pageSize(),
    };
    const state = this.state();
    if (state !== 'ALL') {
      params['state'] = state;
    }
    const year = this.year();
    if (year !== null) {
      params['year'] = year;
    }
    if (this.query()) {
      params['q'] = this.query();
    }
    const subscriberId = this.suscriptor();
    if (subscriberId) {
      params['subscriberId'] = subscriberId;
    }
    return { url: INVOICES_URL, params };
  });

  protected readonly columns = [
    'number',
    'subscriber',
    'period',
    'consumption',
    'total',
    'state',
    'actions',
  ];
  protected readonly years = lastYears(5);

  // Las filas de mat-table no tienen tipo: estos métodos conservan el tipado estricto
  protected periodOf(invoice: Invoice): string {
    return periodLabel(invoice);
  }

  protected stateOf(invoice: Invoice): string {
    return INVOICE_STATE_LABELS[invoice.state];
  }

  protected consumptionOf(invoice: Invoice): string {
    return METERED_SERVICES.has(invoice.serviceType)
      ? `${invoice.consumption} ${unitOf(invoice.serviceType)}`
      : '—';
  }

  protected canCollect(invoice: Invoice): boolean {
    return isOpen(invoice) && this.session.canOperateOrganization();
  }

  protected filterBy(state: StateFilter): void {
    this.pageIndex.set(0);
    this.state.set(state);
  }

  protected filterByYear(year: number | null): void {
    this.pageIndex.set(0);
    this.year.set(year);
  }

  /** Descarga para Excel las facturas que cumplen los filtros actuales (todas las páginas). */
  protected export(): void {
    const params: Record<string, string | number> = {};
    const state = this.state();
    if (state !== 'ALL') {
      params['state'] = state;
    }
    const year = this.year();
    if (year !== null) {
      params['year'] = year;
    }
    if (this.query()) {
      params['q'] = this.query();
    }
    const subscriberId = this.suscriptor();
    if (subscriberId) {
      params['subscriberId'] = subscriberId;
    }
    this.http.get(`${INVOICES_URL}/export`, { params, responseType: 'blob' }).subscribe({
      next: (file) => saveFile(file, 'facturas.csv'),
      error: (error: unknown) => this.notifier.apiError(error),
    });
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

  protected pay(invoice: Invoice, method: PaymentMethod): void {
    this.payments.pay(invoice, method).subscribe({
      next: () => this.invoices.reload(),
      error: () => undefined,
    });
  }

  /** Día límite de pago y recargo por no pago del prestador. */
  protected openSettings(): void {
    this.dialog
      .open<BillingSettingsDialog, void, BillingSettings>(BillingSettingsDialog, { width: '480px' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.notifier.success('Configuración guardada: aplica a las próximas facturas');
        }
      });
  }
}

function lastYears(count: number): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: count }, (_, index) => current - index);
}
