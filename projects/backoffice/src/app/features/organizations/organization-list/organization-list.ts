import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  ORGANIZATION_STATUS_LABELS,
  ORGANIZATION_TYPE_LABELS,
  SERVICE_ICONS,
  SERVICE_LABELS,
} from '../../../core/i18n/labels';
import { displayName, Organization, Page, ServiceType } from '../organization.models';
import { ORGANIZATIONS_URL } from '../organizations-api';

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
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);

  /** Se vuelve a consultar sola cuando cambian la página o el tamaño. */
  protected readonly organizations = httpResource<Page<Organization>>(() => ({
    url: ORGANIZATIONS_URL,
    params: { page: this.pageIndex(), size: this.pageSize() },
  }));

  protected readonly columns = ['name', 'nit', 'type', 'services', 'status'];
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

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
}
