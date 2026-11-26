import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session-store';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { saveFile } from '../../../shared/ui/save-file';
import { PAYMENT_METHOD_LABELS } from '../../invoices/invoice.models';
import { SERVICE_TYPES, ServiceType } from '../../organizations/organization.models';
import { periodLabel } from '../../readings/reading.models';
import { METERED_SERVICES } from '../../subscribers/subscriber.models';
import { unitOf } from '../../tariffs/tariff.models';
import { ConceptColumn, ConceptTable } from '../concept-table/concept-table';
import {
  CollectionEntry,
  ConceptReport,
  ConsumptionRange,
  Debtor,
  Collections,
  isoDate,
  PaymentReversal,
  REPORTS_URL,
} from '../report.models';

/**
 * Informe de recaudo: los pagos recibidos entre dos fechas con el total por medio de pago (sirve como cierre de
 * caja del día). Desde aquí también se descargan el recaudo y la cartera para Excel.
 */
@Component({
  selector: 'aq-collections-report',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatButtonToggleModule,
    ConceptTable,
  ],
  templateUrl: './collections-report.html',
  styleUrl: './collections-report.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionsReport {
  private readonly http = inject(HttpClient);
  private readonly notifier = inject(Notifier);
  private readonly session = inject(SessionStore);

  /** Por defecto, hoy: el recaudo del día. */
  protected readonly from = signal(isoDate(new Date()));
  protected readonly to = signal(isoDate(new Date()));
  protected readonly validRange = computed(
    () => this.from() !== '' && this.to() !== '' && this.from() <= this.to(),
  );

  /** Se vuelve a consultar sola al cambiar las fechas o el prestador de la sesión. */
  protected readonly collections = httpResource<Collections>(() => {
    if (!this.session.organization()?.organizationId || !this.validRange()) {
      return undefined;
    }
    return { url: `${REPORTS_URL}/collections`, params: { from: this.from(), to: this.to() } };
  });

  /** Los pagos reversados del rango se consultan solo cuando se piden. */
  protected readonly showReversals = signal(false);
  protected readonly reversals = httpResource<PaymentReversal[]>(() => {
    if (
      !this.showReversals() ||
      !this.session.organization()?.organizationId ||
      !this.validRange()
    ) {
      return undefined;
    }
    return {
      url: `${REPORTS_URL}/payment-reversals`,
      params: { from: this.from(), to: this.to() },
    };
  });
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;

  /** Los que más deben a hoy; se consultan solo cuando se piden. */
  protected readonly showDebtors = signal(false);
  protected readonly debtors = httpResource<Debtor[]>(() =>
    this.showDebtors() && this.session.organization()?.organizationId
      ? `${REPORTS_URL}/top-debtors`
      : undefined,
  );

  /**
   * Por concepto: lo recaudado en las fechas de arriba o lo facturado en un periodo. Se consulta cuando se pide y
   * luego sigue los cambios de fechas, periodo o prestador.
   */
  protected readonly conceptBasis = signal<ConceptBasis>('COLLECTED');
  protected readonly conceptMonth = signal(isoDate(new Date()).slice(0, 7));
  protected readonly showConcepts = signal(false);
  protected readonly conceptsReady = computed(() =>
    this.conceptBasis() === 'COLLECTED'
      ? this.validRange()
      : yearMonth(this.conceptMonth()) !== null,
  );
  protected readonly concepts = httpResource<ConceptReport>(() => {
    if (!this.showConcepts() || !this.session.organization()?.organizationId) {
      return undefined;
    }
    if (this.conceptBasis() === 'COLLECTED') {
      return this.validRange()
        ? {
            url: `${REPORTS_URL}/collected-by-concept`,
            params: { from: this.from(), to: this.to() },
          }
        : undefined;
    }
    const period = yearMonth(this.conceptMonth());
    return period ? { url: `${REPORTS_URL}/billed-by-concept`, params: period } : undefined;
  });
  protected readonly conceptColumns = computed<ConceptColumn[]>(() =>
    this.concepts.hasValue()
      ? this.concepts.value().services.map((service) => ({
          label: SERVICE_LABELS[service.serviceType],
          concepts: service.concepts,
        }))
      : [],
  );

  /** Consumo por rango de tarifa: se consulta cuando se pide, para el mes y el servicio elegidos. */
  protected readonly meteredServices = SERVICE_TYPES.filter((service) =>
    METERED_SERVICES.has(service),
  );
  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly rangesMonth = signal(isoDate(new Date()).slice(0, 7));
  protected readonly rangesService = signal<ServiceType>('WATER');
  protected readonly showRanges = signal(false);
  protected readonly ranges = httpResource<ConsumptionRange[]>(() => {
    const [year, month] = this.rangesMonth().split('-').map(Number);
    if (!this.showRanges() || !this.session.organization()?.organizationId || !year || !month) {
      return undefined;
    }
    return {
      url: `${REPORTS_URL}/consumption-ranges`,
      params: { year, month, serviceType: this.rangesService() },
    };
  });
  protected readonly rangesUnit = computed(() => unitOf(this.rangesService()));
  protected readonly rangeTotals = computed(() => {
    const ranges = this.ranges.hasValue() ? this.ranges.value() : [];
    return {
      invoices: ranges.reduce((sum, range) => sum + range.invoices, 0),
      charge: ranges.reduce((sum, range) => sum + range.charge, 0),
    };
  });

  /** «Sin consumo», «1 a 10 m³», «Más de 20 m³». */
  protected rangeLabel(range: ConsumptionRange): string {
    const unit = this.rangesUnit();
    if (range.pricePerUnit === null) {
      return 'Sin consumo';
    }
    return range.upTo === null
      ? `Más de ${range.from} ${unit}`
      : `Más de ${range.from} y hasta ${range.upTo} ${unit}`;
  }

  /** Porcentaje entero de una parte sobre el total. */
  protected share(part: number, total: number): number {
    return total === 0 ? 0 : Math.round((part / total) * 100);
  }

  protected readonly columns = ['paidAt', 'invoice', 'subscriber', 'period', 'method', 'amount'];

  // Las filas de mat-table no tienen tipo: estos métodos conservan el tipado estricto
  protected periodOf(payment: CollectionEntry): string {
    return periodLabel(payment);
  }

  protected methodOf(payment: CollectionEntry): string {
    return PAYMENT_METHOD_LABELS[payment.method];
  }

  protected thisMonth(): void {
    const today = new Date();
    this.from.set(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
    this.to.set(isoDate(today));
  }

  protected today(): void {
    const today = isoDate(new Date());
    this.from.set(today);
    this.to.set(today);
  }

  protected downloadCollections(): void {
    this.download(
      `${REPORTS_URL}/collections/export?from=${this.from()}&to=${this.to()}`,
      `recaudo-${this.from()}-a-${this.to()}.csv`,
    );
  }

  protected downloadConcepts(): void {
    if (this.conceptBasis() === 'COLLECTED') {
      this.download(
        `${REPORTS_URL}/collected-by-concept/export?from=${this.from()}&to=${this.to()}`,
        `recaudo-por-concepto-${this.from()}-a-${this.to()}.csv`,
      );
      return;
    }
    const period = yearMonth(this.conceptMonth());
    if (period) {
      this.download(
        `${REPORTS_URL}/billed-by-concept/export?year=${period.year}&month=${period.month}`,
        `facturado-por-concepto-${this.conceptMonth()}.csv`,
      );
    }
  }

  protected downloadDebts(): void {
    this.download(`${REPORTS_URL}/debts/export`, `cartera-${isoDate(new Date())}.csv`);
  }

  private download(url: string, fileName: string): void {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (file) => saveFile(file, fileName),
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }
}

type ConceptBasis = 'COLLECTED' | 'BILLED';

/** Año y mes de un campo `yyyy-MM`, o `null` si está vacío. */
function yearMonth(value: string): { year: number; month: number } | null {
  const [year, month] = value.split('-').map(Number);
  return year && month ? { year, month } : null;
}
