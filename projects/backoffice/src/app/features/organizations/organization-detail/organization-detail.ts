import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { filter, Observable, switchMap } from 'rxjs';
import {
  ORGANIZATION_STATUS_LABELS,
  ORGANIZATION_TYPE_LABELS,
  SERVICE_ICONS,
  SERVICE_LABELS,
} from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import {
  Affiliation,
  canAffiliateOthers,
  displayName,
  Organization,
  Page,
  SERVICE_TYPES,
  ServiceType,
} from '../organization.models';
import { AFFILIATIONS_URL, ORGANIZATIONS_URL, OrganizationsApi } from '../organizations-api';
import { MemberTarget } from '../../members/member.models';
import { MemberList } from '../../members/member-list/member-list';

/** Prestadores que se cargan para elegir a quién vincular (y mostrar nombres de los vinculados). */
const CATALOG_SIZE = 100;

@Component({
  selector: 'aq-organization-detail',
  imports: [
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MemberList,
  ],
  templateUrl: './organization-detail.html',
  styleUrl: './organization-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationDetail {
  private readonly api = inject(OrganizationsApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);

  /** Parámetro de ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly organization = httpResource<Organization>(
    () => `${ORGANIZATIONS_URL}/${this.id()}`,
  );
  /** Sus usuarios se administran aquí mismo, sin operar como el prestador. */
  protected readonly memberTarget = computed<MemberTarget | undefined>(() => {
    const organization = this.organization.hasValue() ? this.organization.value() : undefined;
    return organization
      ? { organizationId: organization.id, name: displayName(organization) }
      : undefined;
  });
  protected readonly canAffiliate = computed(() => {
    const organization = this.organization.hasValue() ? this.organization.value() : undefined;
    return organization ? canAffiliateOthers(organization.type) : false;
  });
  protected readonly affiliations = httpResource<Affiliation[]>(() =>
    this.canAffiliate()
      ? { url: AFFILIATIONS_URL, params: { parentOrganizationId: this.id() } }
      : undefined,
  );
  protected readonly catalog = httpResource<Page<Organization>>(() =>
    this.canAffiliate()
      ? { url: ORGANIZATIONS_URL, params: { page: 0, size: CATALOG_SIZE } }
      : undefined,
  );

  private readonly namesById = computed(() => {
    const items = this.catalog.hasValue() ? this.catalog.value().items : [];
    return new Map(items.map((organization) => [organization.id, displayName(organization)]));
  });

  /** Activos, distintos de este y aún no vinculados a él. El backend valida el resto de reglas. */
  protected readonly candidates = computed(() => {
    const items = this.catalog.hasValue() ? this.catalog.value().items : [];
    const affiliated = new Set(
      (this.affiliations.hasValue() ? this.affiliations.value() : []).map(
        (affiliation) => affiliation.childOrganizationId,
      ),
    );
    return items.filter(
      (organization) =>
        organization.id !== this.id() &&
        organization.status === 'ACTIVE' &&
        !affiliated.has(organization.id),
    );
  });

  protected readonly selectedChild = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly serviceTypes = SERVICE_TYPES;
  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly serviceIcons = SERVICE_ICONS;
  protected readonly typeLabels = ORGANIZATION_TYPE_LABELS;
  protected readonly statusLabels = ORGANIZATION_STATUS_LABELS;
  protected readonly displayName = displayName;

  protected nameOf(organizationId: string): string {
    return this.namesById().get(organizationId) ?? organizationId;
  }

  protected toggleService(
    organization: Organization,
    service: ServiceType,
    enabled: boolean,
  ): void {
    const request = enabled
      ? this.api.enableService(organization.id, service)
      : this.api.disableService(organization.id, service);
    this.run(request, (updated) => this.organization.value.set(updated), {
      422: 'Un prestador debe ofrecer al menos un servicio.',
    });
  }

  protected changeStatus(organization: Organization): void {
    const suspending = organization.status === 'ACTIVE';
    const data: ConfirmDialogData = suspending
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
    this.confirm(data, () =>
      suspending ? this.api.suspend(organization.id) : this.api.activate(organization.id),
    ).subscribe({
      next: (updated) => {
        this.organization.value.set(updated);
        this.notifier.success(suspending ? 'Prestador suspendido' : 'Prestador reactivado');
      },
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }

  protected affiliate(): void {
    const childId = this.selectedChild();
    if (!childId) {
      return;
    }
    this.run(
      this.api.affiliate(this.id(), childId),
      () => {
        this.selectedChild.set(null);
        this.affiliations.reload();
        this.notifier.success(`${this.nameOf(childId)} quedó vinculado`);
      },
      {
        422: 'No se puede vincular: el prestador ya está vinculado a otra empresa, tiene sus propios vinculados o está suspendido.',
      },
    );
  }

  protected endAffiliation(affiliation: Affiliation): void {
    const name = this.nameOf(affiliation.childOrganizationId);
    this.confirm(
      {
        title: 'Terminar vinculación',
        message: `${name} dejará de estar vinculado. Los usuarios de esta empresa perderán el acceso heredado a él.`,
        confirmLabel: 'Terminar vinculación',
        danger: true,
      },
      () => this.api.endAffiliation(affiliation.id),
    ).subscribe({
      next: () => {
        this.affiliations.reload();
        this.notifier.success(`Se terminó la vinculación con ${name}`);
      },
      error: (error: unknown) => this.notifier.apiError(error),
    });
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

  private run<T>(
    request: Observable<T>,
    onSuccess: (value: T) => void,
    messages: Partial<Record<number, string>> = {},
  ): void {
    this.busy.set(true);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        onSuccess(value);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.notifier.apiError(error, messages);
      },
    });
  }
}
