import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { SessionStore } from '../../../core/auth/session-store';
import { SERVICE_ICONS, SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { Organization, SERVICE_TYPES, ServiceType } from '../../organizations/organization.models';
import { SERVICE_AREAS_URL, ServiceArea } from '../../service-areas/service-area.models';
import {
  METERED_SERVICES,
  PROPERTY_USAGE_LABELS,
  PROPERTY_USAGES,
  PropertyUsage,
  STRATA,
} from '../../subscribers/subscriber.models';
import { CURRENT_ORGANIZATION_URL } from '../../subscribers/subscribers-api';
import { blockLabel, Tariff, TariffAdjustment, TariffCharge, unitOf } from '../tariff.models';
import { TARIFFS_URL, TariffsApi } from '../tariffs-api';
import { BillingSettingsDialog } from '../../invoices/billing-settings-dialog/billing-settings-dialog';
import { BillingSettings } from '../../invoices/invoice.models';

/** Tarifas del prestador: la vigente de cada servicio, sus versiones y un simulador de factura. */
@Component({
  selector: 'aq-tariff-list',
  imports: [
    CurrencyPipe,
    DatePipe,
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
  ],
  templateUrl: './tariff-list.html',
  styleUrl: './tariff-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TariffList {
  private readonly api = inject(TariffsApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Servicio a mostrar al entrar (query param `servicio`), p. ej. al volver de crear una tarifa. */
  readonly servicio = input<ServiceType>();

  private readonly organization = httpResource<Organization>(() => CURRENT_ORGANIZATION_URL);
  protected readonly services = computed<ServiceType[]>(() => {
    const offered = this.organization.hasValue() ? this.organization.value().services : [];
    return SERVICE_TYPES.filter((service) => offered.includes(service));
  });
  protected readonly selected = signal<ServiceType | null>(null);
  /** Las áreas son opcionales: sin ninguna registrada solo existe la tarifa general. */
  protected readonly areas = httpResource<ServiceArea[]>(() => SERVICE_AREAS_URL);
  /** `null`: la tarifa general. */
  protected readonly area = signal<string | null>(null);

  protected readonly tariffs = httpResource<Tariff[]>(() => {
    const serviceType = this.selected();
    return serviceType ? { url: TARIFFS_URL, params: { serviceType } } : undefined;
  });
  protected readonly current = computed(() => this.versions().find((tariff) => tariff.inEffect));
  protected readonly upcoming = computed(() =>
    this.versions().filter((tariff) => !tariff.inEffect && this.isFuture(tariff)),
  );
  protected readonly previous = computed(() =>
    this.versions().filter((tariff) => !tariff.inEffect && !this.isFuture(tariff)),
  );

  // Simulador
  protected readonly consumption = signal(15);
  protected readonly usage = signal<PropertyUsage>('RESIDENTIAL');
  protected readonly stratum = signal(2);
  protected readonly estimate = signal<TariffCharge | null>(null);
  protected readonly estimating = signal(false);

  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly serviceIcons = SERVICE_ICONS;
  protected readonly usages = PROPERTY_USAGES;
  protected readonly usageLabels = PROPERTY_USAGE_LABELS;
  protected readonly strata = STRATA;
  protected readonly blockLabel = blockLabel;
  protected readonly unitOf = unitOf;

  constructor() {
    // Al cargar los servicios del prestador, selecciona el pedido en la URL o el primero
    effect(() => {
      const services = this.services();
      if (services.length > 0 && this.selected() === null) {
        const requested = this.servicio();
        this.selected.set(requested && services.includes(requested) ? requested : services[0]);
      }
    });
  }

  protected selectArea(area: string | null): void {
    this.area.set(area);
    this.estimate.set(null);
  }

  protected newTariffParams(service: ServiceType): Record<string, string> {
    const area = this.area();
    return area ? { servicio: service, area } : { servicio: service };
  }

  protected select(service: ServiceType): void {
    this.selected.set(service);
    this.estimate.set(null);
  }

  protected isMetered(service: ServiceType): boolean {
    return METERED_SERVICES.has(service);
  }

  protected adjustmentLabel(adjustment: TariffAdjustment): string {
    const target =
      adjustment.stratum !== null
        ? `Estrato ${adjustment.stratum}`
        : PROPERTY_USAGE_LABELS[adjustment.usage];
    const kind = adjustment.percent < 0 ? 'subsidio' : 'contribución';
    return `${target}: ${kind} del ${Math.abs(adjustment.percent)} %`;
  }

  protected simulate(): void {
    const service = this.selected();
    if (!service) {
      return;
    }
    this.estimating.set(true);
    this.api
      .estimate(
        service,
        this.isMetered(service) ? Math.max(0, this.consumption()) : 0,
        this.usage(),
        this.usage() === 'RESIDENTIAL' ? this.stratum() : null,
        this.area(),
      )
      .subscribe({
        next: (charge) => {
          this.estimating.set(false);
          this.estimate.set(charge);
        },
        error: (error: unknown) => {
          this.estimating.set(false);
          this.estimate.set(null);
          this.notifier.apiError(error, { 422: 'Este servicio aún no tiene una tarifa vigente.' });
        },
      });
  }

  protected remove(tariff: Tariff): void {
    const data: ConfirmDialogData = {
      title: 'Eliminar tarifa programada',
      message: 'La tarifa aún no ha entrado en vigencia. Se elimina y sigue aplicando la actual.',
      confirmLabel: 'Eliminar',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.api.delete(tariff.id)),
      )
      .subscribe({
        next: () => {
          this.tariffs.reload();
          this.notifier.success('Tarifa programada eliminada');
        },
        error: (error: unknown) =>
          this.notifier.apiError(error, {
            422: 'La tarifa ya está vigente: no se puede eliminar.',
          }),
      });
  }

  /** Plazo de pago y recargo opcional por no pago: se configuran junto a lo que se cobra. */
  protected openBillingRules(): void {
    this.dialog
      .open<BillingSettingsDialog, void, BillingSettings>(BillingSettingsDialog, { width: '480px' })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.notifier.success('Configuración guardada: aplica a las próximas facturas');
        }
      });
  }

  /** Las versiones del área elegida: cada área tiene su propia vigencia. */
  private versions(): Tariff[] {
    const all = this.tariffs.hasValue() ? this.tariffs.value() : [];
    return all.filter((tariff) => (tariff.serviceAreaId ?? null) === this.area());
  }

  /** Posterior a la vigente (o a hoy, si no hay ninguna vigente): aún no aplica. */
  private isFuture(tariff: Tariff): boolean {
    const reference = this.current()?.validFrom ?? new Date().toISOString().slice(0, 10);
    return tariff.validFrom > reference;
  }
}
