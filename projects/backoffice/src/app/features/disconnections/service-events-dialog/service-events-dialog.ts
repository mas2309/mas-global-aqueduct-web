import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { DISCONNECTIONS_URL, SERVICE_ACTION_LABELS, ServiceEvent } from '../disconnection.models';

export interface ServiceEventsData {
  propertyId: string;
  address: string;
}

/** Rastro de suspensiones, cortes y restablecimientos de un predio. */
@Component({
  selector: 'aq-service-events-dialog',
  imports: [CurrencyPipe, DatePipe, MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Historial de cortes</h2>
    <mat-dialog-content>
      <p class="muted">{{ data.address }}</p>
      @if (events.error()) {
        <p class="error" role="alert">No pudimos cargar el historial.</p>
      } @else if (events.hasValue()) {
        <ul class="events">
          @for (event of events.value(); track event.id) {
            <li>
              <strong>{{ actionLabels[event.action] }}</strong>
              de {{ serviceLabels[event.serviceType].toLowerCase() }} ·
              {{ event.performedAt | date: 'medium' }}
              @if (event.cause) {
                <br />Causal: {{ event.cause }}
              }
              @if (event.fee > 0) {
                <br />Valor: {{ event.fee | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
              }
              @if (event.overridden) {
                <br />Autorizado con deuda vencida
              }
              @if (event.notes) {
                <br /><span class="muted">{{ event.notes }}</span>
              }
            </li>
          } @empty {
            <li class="muted">Este predio no tiene suspensiones ni cortes registrados.</li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .events {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
  `,
})
export class ServiceEventsDialog {
  protected readonly data = inject<ServiceEventsData>(MAT_DIALOG_DATA);
  protected readonly events = httpResource<ServiceEvent[]>(
    () => `${DISCONNECTIONS_URL}/properties/${this.data.propertyId}/events`,
  );
  protected readonly actionLabels = SERVICE_ACTION_LABELS;
  protected readonly serviceLabels = SERVICE_LABELS;
}
