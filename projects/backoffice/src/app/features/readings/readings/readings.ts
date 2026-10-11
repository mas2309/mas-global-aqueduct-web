import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { filter, Observable, switchMap } from 'rxjs';
import { SessionStore } from '../../../core/auth/session-store';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { Organization, SERVICE_TYPES, ServiceType } from '../../organizations/organization.models';
import { METERED_SERVICES } from '../../subscribers/subscriber.models';
import { CURRENT_ORGANIZATION_URL } from '../../subscribers/subscribers-api';
import { unitOf } from '../../tariffs/tariff.models';
import { FirstPeriod, OpenPeriodDialog } from '../open-period-dialog/open-period-dialog';
import { ReadingRow } from '../reading-row/reading-row';
import { BillingPeriod, nextPeriod, periodLabel, Reading, RouteEntry } from '../reading.models';
import { PERIODS_URL, ReadingsApi } from '../readings-api';

/**
 * Lecturas del periodo: la ruta completa de medidores con su lectura anterior, para digitar la actual. Sirve tanto
 * para capturar en oficina desde la planilla del fontanero como para revisar lo que llegue de la app móvil.
 */
@Component({
  selector: 'aq-readings',
  imports: [
    FormsModule,
    ReadingRow,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressBarModule,
  ],
  templateUrl: './readings.html',
  styleUrl: './readings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Readings {
  private readonly api = inject(ReadingsApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  private readonly organization = httpResource<Organization>(() => CURRENT_ORGANIZATION_URL);
  /** Servicios medidos que ofrece el prestador. */
  protected readonly services = computed<ServiceType[]>(() => {
    const offered = this.organization.hasValue() ? this.organization.value().services : [];
    return SERVICE_TYPES.filter(
      (service) => offered.includes(service) && METERED_SERVICES.has(service),
    );
  });
  protected readonly service = signal<ServiceType | null>(null);

  protected readonly periods = httpResource<BillingPeriod[]>(() => PERIODS_URL);
  protected readonly periodId = signal<string | null>(null);
  protected readonly period = computed(() => {
    const periods = this.periods.hasValue() ? this.periods.value() : [];
    return periods.find((period) => period.id === this.periodId()) ?? null;
  });
  /** El más reciente: de él depende si se puede abrir otro. */
  protected readonly latest = computed(() =>
    this.periods.hasValue() ? (this.periods.value()[0] ?? null) : null,
  );

  protected readonly route = httpResource<RouteEntry[]>(() => {
    const periodId = this.periodId();
    const serviceType = this.service();
    return periodId && serviceType
      ? { url: `${PERIODS_URL}/${periodId}/route`, params: { serviceType } }
      : undefined;
  });

  protected readonly searchText = signal('');
  protected readonly onlyPending = signal(false);
  protected readonly entries = computed(() => {
    const text = this.searchText().trim().toLowerCase();
    const all = this.route.hasValue() ? this.route.value() : [];
    return all.filter(
      (entry) =>
        (!this.onlyPending() || entry.reading === null) &&
        (!text ||
          entry.subscriberName.toLowerCase().includes(text) ||
          String(entry.subscriberCode).includes(text) ||
          entry.address.toLowerCase().includes(text) ||
          (entry.sector ?? '').toLowerCase().includes(text) ||
          (entry.meterSerial ?? '').toLowerCase().includes(text)),
    );
  });
  protected readonly total = computed(() =>
    this.route.hasValue() ? this.route.value().length : 0,
  );
  protected readonly done = computed(() =>
    this.route.hasValue() ? this.route.value().filter((entry) => entry.reading !== null).length : 0,
  );
  protected readonly unusual = computed(() =>
    this.route.hasValue() ? this.route.value().filter((entry) => entry.reading?.unusual).length : 0,
  );
  protected readonly editable = computed(
    () => this.period()?.status === 'OPEN' && this.session.canOperateOrganization(),
  );
  protected readonly unit = computed(() => unitOf(this.service() ?? 'WATER'));

  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly periodLabel = periodLabel;

  constructor() {
    // Por defecto, el periodo más reciente y el primer servicio medido
    effect(() => {
      const latest = this.latest();
      if (latest && this.periodId() === null) {
        this.periodId.set(latest.id);
      }
    });
    effect(() => {
      const services = this.services();
      if (services.length > 0 && this.service() === null) {
        this.service.set(services[0]);
      }
    });
  }

  protected nextLabel(period: BillingPeriod): string {
    return periodLabel(nextPeriod(period));
  }

  /** El primer periodo se elige; los demás son siempre el mes siguiente. */
  protected openPeriod(): void {
    const latest = this.latest();
    const which: Observable<FirstPeriod> = latest
      ? this.confirm({
          title: `Abrir ${this.nextLabel(latest)}`,
          message: 'Se abre el siguiente periodo para registrar sus lecturas.',
          confirmLabel: 'Abrir periodo',
        }).pipe(switchMap(() => [nextPeriod(latest)]))
      : this.dialog
          .open<OpenPeriodDialog, void, FirstPeriod>(OpenPeriodDialog, { width: '440px' })
          .afterClosed()
          .pipe(filter((period) => period !== undefined));
    which.pipe(switchMap((period) => this.api.openPeriod(period.year, period.month))).subscribe({
      next: (opened) => {
        this.periodId.set(opened.id);
        this.periods.reload();
        this.notifier.success(`Periodo ${periodLabel(opened)} abierto`);
      },
      error: (error: unknown) =>
        this.notifier.apiError(error, {
          403: 'Solo el administrador del prestador abre y cierra periodos.',
          409: 'Ese periodo ya existe.',
          422: 'Cierra el periodo abierto antes de abrir el siguiente.',
        }),
    });
  }

  protected closePeriod(period: BillingPeriod): void {
    const pending = this.total() - this.done();
    this.confirm({
      title: `Cerrar ${periodLabel(period)}`,
      message:
        (pending > 0 ? `Quedan ${pending} medidores sin lectura. ` : '') +
        'Al cerrar, las lecturas quedan en firme y ya no se pueden modificar.',
      confirmLabel: 'Cerrar periodo',
      danger: true,
    })
      .pipe(switchMap(() => this.api.closePeriod(period.id)))
      .subscribe({
        next: () => {
          this.periods.reload();
          this.notifier.success(`Periodo ${periodLabel(period)} cerrado`);
        },
        error: (error: unknown) =>
          this.notifier.apiError(error, {
            403: 'Solo el administrador del prestador abre y cierra periodos.',
          }),
      });
  }

  /** Actualiza la fila en memoria: no se recarga toda la ruta por cada lectura. */
  protected onChanged(entry: RouteEntry, reading: Reading | null): void {
    this.route.value.update((entries) =>
      (entries ?? []).map((item) =>
        item.propertyId === entry.propertyId ? { ...item, reading } : item,
      ),
    );
  }

  private confirm(data: ConfirmDialogData): Observable<true> {
    return this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(filter((confirmed): confirmed is true => confirmed === true));
  }
}
