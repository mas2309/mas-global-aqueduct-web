import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { filter, Observable, switchMap } from 'rxjs';
import { SessionStore } from '../../../core/auth/session-store';
import { SERVICE_ICONS, SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { InstallmentPlans } from '../../invoices/installment-plans/installment-plans';
import { Organization, SERVICE_TYPES, ServiceType } from '../../organizations/organization.models';
import { MeterDialog, MeterDialogData } from '../meter-dialog/meter-dialog';
import { PortalLink } from '../portal-link/portal-link';
import { PropertyDialog, PropertyDialogData } from '../property-dialog/property-dialog';
import {
  DOCUMENT_TYPE_LABELS,
  formatCode,
  METERED_SERVICES,
  Property,
  PROPERTY_USAGE_LABELS,
  PropertyService,
  Subscriber,
} from '../subscriber.models';
import { CURRENT_ORGANIZATION_URL, SUBSCRIBERS_URL, SubscribersApi } from '../subscribers-api';

/** Un servicio que ofrece el prestador y, si existe, su acometida en el predio. */
interface ServiceRow {
  serviceType: ServiceType;
  connection: PropertyService | undefined;
}

/** Ficha del suscriptor: sus datos, sus predios y los servicios conectados a cada uno. */
@Component({
  selector: 'aq-subscriber-detail',
  imports: [
    RouterLink,
    InstallmentPlans,
    PortalLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
  ],
  templateUrl: './subscriber-detail.html',
  styleUrl: './subscriber-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriberDetail {
  private readonly api = inject(SubscribersApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Parámetro de ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly subscriber = httpResource<Subscriber>(() => `${SUBSCRIBERS_URL}/${this.id()}`);
  protected readonly properties = httpResource<Property[]>(
    () => `${SUBSCRIBERS_URL}/${this.id()}/properties`,
  );
  /** El prestador actual: solo se pueden conectar los servicios que ofrece. */
  private readonly organization = httpResource<Organization>(() => CURRENT_ORGANIZATION_URL);

  protected readonly offeredServices = computed<ServiceType[]>(() => {
    const offered = this.organization.hasValue() ? this.organization.value().services : [];
    return SERVICE_TYPES.filter((service) => offered.includes(service));
  });
  protected readonly busy = signal(false);

  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly serviceIcons = SERVICE_ICONS;
  protected readonly usageLabels = PROPERTY_USAGE_LABELS;
  protected readonly documentTypeLabels = DOCUMENT_TYPE_LABELS;
  protected readonly formatCode = formatCode;

  /** Servicios ofrecidos por el prestador, más los que el predio ya tenga conectados. */
  protected servicesOf(property: Property): ServiceRow[] {
    const types = new Set<ServiceType>([
      ...this.offeredServices(),
      ...property.services.map((service) => service.serviceType),
    ]);
    return SERVICE_TYPES.filter((type) => types.has(type)).map((serviceType) => ({
      serviceType,
      connection: property.services.find((service) => service.serviceType === serviceType),
    }));
  }

  protected isMetered(service: ServiceType): boolean {
    return METERED_SERVICES.has(service);
  }

  protected changeStatus(subscriber: Subscriber): void {
    if (subscriber.status === 'INACTIVE') {
      this.run(this.api.activate(subscriber.id), (updated) => {
        this.subscriber.value.set(updated);
        this.notifier.success('Suscriptor reactivado');
      });
      return;
    }
    this.confirm(
      {
        title: 'Desactivar suscriptor',
        message: `${subscriber.fullName} dejará de recibir facturas nuevas. Su historial se conserva y puedes reactivarlo después.`,
        confirmLabel: 'Desactivar',
        danger: true,
      },
      () => this.api.deactivate(subscriber.id),
    ).subscribe({
      next: (updated) => {
        this.subscriber.value.set(updated);
        this.notifier.success('Suscriptor desactivado');
      },
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }

  protected openProperty(property?: Property): void {
    const data: PropertyDialogData = { subscriberId: this.id(), property };
    this.dialog
      .open<PropertyDialog, PropertyDialogData, Property>(PropertyDialog, { data, width: '480px' })
      .afterClosed()
      .pipe(filter((saved) => saved !== undefined))
      .subscribe(() => {
        this.properties.reload();
        this.notifier.success(property ? 'Predio actualizado' : 'Predio agregado');
      });
  }

  /** Conecta un servicio. Los medidos preguntan por el medidor; los demás se conectan de una vez. */
  protected connect(property: Property, service: ServiceType): void {
    if (this.isMetered(service)) {
      this.openMeter(property, service, undefined);
      return;
    }
    this.run(this.api.connectService(property.id, service, null), () =>
      this.refresh(`${SERVICE_LABELS[service]} conectado`),
    );
  }

  protected openMeter(
    property: Property,
    service: ServiceType,
    connection?: PropertyService,
  ): void {
    const data: MeterDialogData = {
      propertyId: property.id,
      serviceType: service,
      currentMeter: connection?.meterSerial ?? null,
      connected: connection !== undefined,
    };
    this.dialog
      .open<MeterDialog, MeterDialogData, Property>(MeterDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(filter((saved) => saved !== undefined))
      .subscribe(() =>
        this.refresh(connection ? 'Medidor actualizado' : `${SERVICE_LABELS[service]} conectado`),
      );
  }

  /** Corte del servicio (p. ej. por falta de pago). */
  protected suspend(property: Property, service: ServiceType): void {
    this.confirm(
      {
        title: `Suspender ${SERVICE_LABELS[service].toLowerCase()}`,
        message: `Se registra el corte del servicio en ${property.address}. Puedes reconectarlo cuando corresponda.`,
        confirmLabel: 'Suspender',
        danger: true,
      },
      () => this.api.suspendService(property.id, service),
    ).subscribe({
      next: () => this.refresh('Servicio suspendido'),
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }

  protected reconnect(property: Property, service: ServiceType): void {
    this.run(this.api.reconnectService(property.id, service), () =>
      this.refresh('Servicio reconectado'),
    );
  }

  /** Reinstala un servicio cortado. El servidor cobra su valor si las reglas del prestador lo fijan. */
  protected restore(property: Property, service: ServiceType): void {
    this.run(this.api.restoreService(property.id, service), () =>
      this.refresh('Servicio reinstalado'),
    );
  }

  protected disconnect(property: Property, service: ServiceType): void {
    this.confirm(
      {
        title: `Retirar ${SERVICE_LABELS[service].toLowerCase()}`,
        message: `Se retira definitivamente la acometida de ${property.address}, con su medidor.`,
        confirmLabel: 'Retirar',
        danger: true,
      },
      () => this.api.disconnectService(property.id, service),
    ).subscribe({
      next: () => this.refresh('Servicio retirado del predio'),
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }

  private refresh(message: string): void {
    this.properties.reload();
    this.notifier.success(message);
  }

  private confirm<T>(data: ConfirmDialogData, action: () => Observable<T>): Observable<T> {
    return this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(action),
      );
  }

  private run<T>(request: Observable<T>, onSuccess: (value: T) => void): void {
    this.busy.set(true);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        onSuccess(value);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.notifier.apiError(error, { 403: 'Tu rol solo permite consultar.' });
      },
    });
  }
}
