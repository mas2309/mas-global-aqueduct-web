import { CurrencyPipe } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { filter, switchMap } from 'rxjs';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { MONTH_OPTIONS } from '../../readings/reading.models';
import { SettlementUsageDialog } from '../settlement-usage-dialog/settlement-usage-dialog';
import { Settlement, SETTLEMENTS_URL } from '../settlement.models';

const FORBIDDEN = 'Disponible para el administrador de la plataforma, sin prestador seleccionado.';

/** Lo que cada prestador le debe a MAS Solutions por un mes. Solo el administrador de la plataforma. */
@Component({
  selector: 'aq-settlement-list',
  imports: [
    CurrencyPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>Liquidación de MAS</h1>
          <span class="muted">Los borradores se recalculan al generar; las emitidas no cambian</span>
        </div>
        <button mat-flat-button [disabled]="busy()" (click)="generate()">
          <mat-icon>calculate</mat-icon>
          Generar o recalcular
        </button>
      </header>

      <div class="filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Mes</mat-label>
          <mat-select [ngModel]="month()" (ngModelChange)="month.set($event)">
            @for (option of months; track option.value) {
              <mat-option [value]="option.value">{{ option.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Año</mat-label>
          <input
            matInput
            type="number"
            min="2000"
            max="2100"
            [ngModel]="year()"
            (ngModelChange)="year.set(+$event)"
          />
        </mat-form-field>
      </div>

      @if (settlements.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Cargando liquidaciones" />
      }
      @if (settlements.error()) {
        <div class="state" role="alert">
          <p>No pudimos cargar las liquidaciones.</p>
          <p class="muted">{{ forbidden }}</p>
        </div>
      } @else if (settlements.hasValue()) {
        @if (settlements.value().length === 0) {
          <div class="state">
            <mat-icon aria-hidden="true">receipt</mat-icon>
            <p>No hay liquidaciones de este mes. Genéralas con el botón de arriba.</p>
          </div>
        } @else {
          <table class="settlements" aria-label="Liquidaciones del mes">
            <thead>
              <tr>
                <th scope="col">Prestador</th>
                <th scope="col">Suscriptores</th>
                <th scope="col">Plan</th>
                <th scope="col">Adicionales</th>
                <th scope="col">Total</th>
                <th scope="col">Estado</th>
                <th scope="col"><span class="cdk-visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (settlement of settlements.value(); track settlement.id) {
                <tr>
                  <td>{{ settlement.organizationName }}</td>
                  <td>{{ settlement.activeSubscribers }}</td>
                  <td>{{ settlement.planCharge | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
                  <td>{{ extras(settlement) | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
                  <td>
                    <strong>{{ settlement.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
                  </td>
                  <td>{{ settlement.status === 'ISSUED' ? 'Emitida' : 'Borrador' }}</td>
                  <td>
                    @if (settlement.status === 'DRAFT') {
                      <button mat-button [disabled]="busy()" (click)="editUsage(settlement)">Consumos</button>
                      <button mat-stroked-button [disabled]="busy()" (click)="issue(settlement)">Emitir</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <p>
            Total del mes:
            <strong>{{ monthTotal() | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
          </p>
        }
      }
    </section>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    .settlements {
      width: 100%;
      border-collapse: collapse;

      th,
      td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
  `,
})
export class SettlementList {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);

  protected readonly year = signal(new Date().getFullYear());
  protected readonly month = signal(new Date().getMonth() + 1);
  protected readonly settlements = httpResource<Settlement[]>(() => ({
    url: SETTLEMENTS_URL,
    params: { year: this.year(), month: this.month() },
  }));
  protected readonly monthTotal = computed(() =>
    (this.settlements.hasValue() ? this.settlements.value() : []).reduce(
      (sum, settlement) => sum + settlement.total,
      0,
    ),
  );
  protected readonly busy = signal(false);
  protected readonly months = MONTH_OPTIONS;
  protected readonly forbidden = FORBIDDEN;

  protected extras(settlement: Settlement): number {
    return settlement.total - settlement.planCharge;
  }

  protected generate(): void {
    this.busy.set(true);
    this.http
      .post<Settlement[]>(SETTLEMENTS_URL, { year: this.year(), month: this.month() })
      .subscribe({
        next: (settlements) => {
          this.busy.set(false);
          this.settlements.set(settlements);
          this.notifier.success('Liquidaciones generadas');
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.notifier.apiError(error, { 403: FORBIDDEN });
        },
      });
  }

  protected editUsage(settlement: Settlement): void {
    this.dialog
      .open<SettlementUsageDialog, Settlement, Settlement>(SettlementUsageDialog, {
        data: settlement,
        width: '440px',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.settlements.reload();
          this.notifier.success('Consumos guardados');
        }
      });
  }

  protected issue(settlement: Settlement): void {
    const data: ConfirmDialogData = {
      title: `Emitir la liquidación de ${settlement.organizationName}`,
      message: 'Queda en firme y ya no cambia, aunque cambien sus suscriptores o consumos.',
      confirmLabel: 'Emitir',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() =>
          this.http.post<Settlement>(`${SETTLEMENTS_URL}/${settlement.id}/issue`, null),
        ),
      )
      .subscribe({
        next: () => {
          this.settlements.reload();
          this.notifier.success('Liquidación emitida');
        },
        error: (error: unknown) => this.notifier.apiError(error, { 403: FORBIDDEN }),
      });
  }
}
