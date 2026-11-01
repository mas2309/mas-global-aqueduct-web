import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import {
  ORGANIZATION_STATUS_LABELS,
  ORGANIZATION_TYPE_LABELS,
  SERVICE_ICONS,
  SERVICE_LABELS,
} from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { statusChangeConfirmation } from '../organization-status';
import { displayName, Organization, Page, ServiceType } from '../organization.models';
import { ORGANIZATIONS_URL, OrganizationsApi } from '../organizations-api';

@Component({
  selector: 'aq-organization-list',
  imports: [
    RouterLink,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  templateUrl: './organization-list.html',
  styleUrl: './organization-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationList {
  private readonly api = inject(OrganizationsApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);

  protected readonly busy = signal(false);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);

  /** Se vuelve a consultar sola cuando cambian la página o el tamaño. */
  protected readonly organizations = httpResource<Page<Organization>>(() => ({
    url: ORGANIZATIONS_URL,
    params: { page: this.pageIndex(), size: this.pageSize() },
  }));

  protected readonly columns = ['name', 'nit', 'type', 'services', 'status', 'actions'];
  protected readonly displayName = displayName;

  // Las filas de mat-table no tienen tipo: estos métodos devuelven las etiquetas con tipado estricto
  protected typeLabel(organization: Organization): string {
    return ORGANIZATION_TYPE_LABELS[organization.type];
  }

  protected statusLabel(organization: Organization): string {
    return ORGANIZATION_STATUS_LABELS[organization.status];
  }

  protected serviceLabel(service: ServiceType): string {
    return SERVICE_LABELS[service];
  }

  protected serviceIcon(service: ServiceType): string {
    return SERVICE_ICONS[service];
  }

  protected statusAction(organization: Organization): string {
    return organization.status === 'ACTIVE' ? 'Suspender' : 'Reactivar';
  }

  protected changeStatus(organization: Organization): void {
    const suspending = organization.status === 'ACTIVE';
    this.dialog
      .open(ConfirmDialog, { data: statusChangeConfirmation(organization), width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => {
          this.busy.set(true);
          return suspending
            ? this.api.suspend(organization.id)
            : this.api.activate(organization.id);
        }),
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.notifier.success(suspending ? 'Prestador suspendido' : 'Prestador reactivado');
          this.organizations.reload();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.notifier.apiError(error);
        },
      });
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
}
