import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Notifier } from '../../../core/ui/notifier';
import { Subscriber } from '../../subscribers/subscriber.models';
import { SUBSCRIBERS_URL } from '../../subscribers/subscribers-api';
import {
  CONNECTION_FEES_URL,
  ConnectionFee,
  ConnectionFeeDialog,
  ConnectionFeeDialogData,
} from '../connection-fee-dialog/connection-fee-dialog';

/** Aportes por conexión del suscriptor y su condición de asociado, que permite cobrarle el reconocimiento. */
@Component({
  selector: 'aq-connection-fees',
  imports: [CurrencyPipe, DatePipe, MatButtonModule, MatCardModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" class="fees">
      <mat-card-header>
        <mat-card-title>Aportes por conexión</mat-card-title>
        <mat-card-subtitle>
          {{ subscriber().associate ? 'Asociado del gestor comunitario' : 'No es asociado' }}
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (fees.error()) {
          <p class="error" role="alert">No pudimos cargar los aportes.</p>
        } @else if (fees.hasValue()) {
          <ul class="list">
            @for (fee of fees.value(); track fee.id) {
              <li>
                <span>{{ fee.createdAt | date: 'mediumDate' }}</span>
                <span class="muted">
                  Costo directo {{ fee.directCost | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                </span>
                <strong>{{ fee.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
              </li>
            } @empty {
              <li class="muted">Este suscriptor no tiene aportes registrados.</li>
            }
          </ul>
        }
        @if (editable()) {
          <div class="actions">
            <button mat-button (click)="toggleAssociate()" [disabled]="busy()">
              {{ subscriber().associate ? 'Quitar como asociado' : 'Marcar como asociado' }}
            </button>
            <button mat-stroked-button (click)="add()">
              <mat-icon>add</mat-icon>
              Registrar aporte
            </button>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .fees {
      margin-top: 16px;
    }
    .list {
      margin: 8px 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
  `,
})
export class ConnectionFees {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);

  readonly subscriber = input.required<Subscriber>();
  readonly editable = input(false);
  /** El suscriptor cambió de condición de asociado. */
  readonly changed = output<Subscriber>();

  /** Por su id: cambiar la condición de asociado no debe volver a consultar los aportes. */
  private readonly subscriberId = computed(() => this.subscriber().id);
  protected readonly fees = httpResource<ConnectionFee[]>(() => ({
    url: CONNECTION_FEES_URL,
    params: { subscriberId: this.subscriberId() },
  }));
  protected readonly busy = signal(false);

  protected add(): void {
    const data: ConnectionFeeDialogData = {
      subscriberId: this.subscriber().id,
      associate: this.subscriber().associate,
    };
    this.dialog
      .open<ConnectionFeeDialog, ConnectionFeeDialogData, ConnectionFee>(ConnectionFeeDialog, {
        data,
        width: '560px',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.fees.reload();
          this.notifier.success('Aporte registrado: se cobra en las próximas facturas');
        }
      });
  }

  protected toggleAssociate(): void {
    const action = this.subscriber().associate ? 'dissociate' : 'associate';
    this.busy.set(true);
    this.http
      .post<Subscriber>(`${SUBSCRIBERS_URL}/${this.subscriber().id}/${action}`, null)
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.changed.emit(updated);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.notifier.apiError(error);
        },
      });
  }
}
