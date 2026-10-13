import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session-store';
import { Notifier } from '../../../core/ui/notifier';
import { saveFile } from '../../../shared/ui/save-file';
import { Page } from '../../organizations/organization.models';
import { DOCUMENT_TYPE_LABELS, formatCode, Subscriber } from '../subscriber.models';
import { SUBSCRIBERS_URL } from '../subscribers-api';

@Component({
  selector: 'aq-subscriber-list',
  imports: [
    RouterLink,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './subscriber-list.html',
  styleUrl: './subscriber-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriberList {
  private readonly http = inject(HttpClient);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Texto en el cuadro de búsqueda; se aplica al enviar, no en cada tecla (conexiones lentas). */
  protected readonly searchText = signal('');
  protected readonly query = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);

  /** Se vuelve a consultar sola al cambiar la búsqueda, la página o el prestador de la sesión. */
  protected readonly subscribers = httpResource<Page<Subscriber>>(() => {
    const organizationId = this.session.organization()?.organizationId;
    if (!organizationId) {
      return undefined;
    }
    const params: Record<string, string | number> = {
      page: this.pageIndex(),
      size: this.pageSize(),
    };
    if (this.query()) {
      params['q'] = this.query();
    }
    return { url: SUBSCRIBERS_URL, params };
  });

  protected readonly columns = ['code', 'name', 'document', 'phone', 'status'];
  protected readonly formatCode = formatCode;

  // Las filas de mat-table no tienen tipo: este método conserva el tipado estricto
  protected documentOf(subscriber: Subscriber): string {
    return subscriber.documentType
      ? `${subscriber.documentType === 'PASSPORT' ? 'Pasaporte' : subscriber.documentType} ${subscriber.documentNumber}`
      : '—';
  }

  protected documentTitle(subscriber: Subscriber): string {
    return subscriber.documentType ? DOCUMENT_TYPE_LABELS[subscriber.documentType] : '';
  }

  /** Descarga para Excel los suscriptores que coinciden con la búsqueda (todos si no hay texto). */
  protected export(): void {
    const params: Record<string, string> = this.query() ? { q: this.query() } : {};
    this.http.get(`${SUBSCRIBERS_URL}/export`, { params, responseType: 'blob' }).subscribe({
      next: (file) => saveFile(file, 'suscriptores.csv'),
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
}
