import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session-store';
import { formatCode } from '../../subscribers/subscriber.models';
import { ClaimFormDialog } from '../claim-form-dialog/claim-form-dialog';
import {
  Claim,
  CLAIM_STATE_LABELS,
  CLAIM_STATES,
  CLAIM_TYPE_LABELS,
  CLAIMS_URL,
  ClaimState,
  deadlineLabel,
  isPending,
} from '../claim.models';

/** PQR del prestador, de la más reciente a la más antigua, con las que están por vencer. */
@Component({
  selector: 'aq-claim-list',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>PQR</h1>
          <span class="muted"
            >Se responden en 15 días hábiles desde el día siguiente a la radicación</span
          >
        </div>
        @if (session.canOperateOrganization()) {
          <button mat-flat-button (click)="file()">
            <mat-icon>add</mat-icon>
            Radicar PQR
          </button>
        }
      </header>

      @if (urgent() > 0) {
        <p class="alert" role="status">
          <mat-icon aria-hidden="true">warning</mat-icon>
          {{ urgent() }} sin responder a 3 días hábiles o menos de vencer. Sin respuesta a tiempo
          quedan en silencio positivo.
        </p>
      }

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter">
        <mat-label>Estado</mat-label>
        <mat-select [ngModel]="state()" (ngModelChange)="state.set($event)">
          <mat-option [value]="null">Todos</mat-option>
          @for (option of states; track option) {
            <mat-option [value]="option">{{ stateLabels[option] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (claims.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Cargando PQR" />
      }
      @if (claims.error()) {
        <div class="state" role="alert">
          <p>No pudimos cargar las PQR.</p>
          <button mat-stroked-button (click)="claims.reload()">Reintentar</button>
        </div>
      } @else if (claims.hasValue()) {
        @if (claims.value().length === 0) {
          <div class="state">
            <mat-icon aria-hidden="true">forum</mat-icon>
            <p>No hay PQR con este filtro.</p>
          </div>
        } @else {
          <table class="claims" aria-label="PQR">
            <thead>
              <tr>
                <th scope="col">N.º</th>
                <th scope="col">Suscriptor</th>
                <th scope="col">Tipo y causal</th>
                <th scope="col">Radicada</th>
                <th scope="col">Estado</th>
                <th scope="col">Plazo</th>
              </tr>
            </thead>
            <tbody>
              @for (claim of claims.value(); track claim.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/pqr', claim.id]">{{ claim.number }}</a>
                  </td>
                  <td>{{ formatCode(claim.subscriberCode) }} · {{ claim.subscriberName }}</td>
                  <td>{{ typeLabels[claim.type] }}: {{ claim.cause }}</td>
                  <td>{{ claim.filedOn | date: 'mediumDate' }}</td>
                  <td>{{ stateLabels[claim.state] }}</td>
                  <td [class.late]="isPending(claim) && claim.businessDaysLeft <= 3">
                    {{ isPending(claim) ? deadlineLabel(claim) : '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </section>
  `,
  styles: `
    .alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: 8px;
      background: var(--mat-sys-tertiary-container);
    }
    .filter {
      margin-bottom: 16px;
    }
    .claims {
      width: 100%;
      border-collapse: collapse;

      th,
      td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
    .late {
      color: var(--mat-sys-error);
      font-weight: 500;
    }
  `,
})
export class ClaimList {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);

  protected readonly state = signal<ClaimState | null>(null);
  protected readonly claims = httpResource<Claim[]>(() => {
    const state = this.state();
    const params: Record<string, string> = state ? { state } : {};
    return { url: CLAIMS_URL, params };
  });
  private readonly alerts = httpResource<Claim[]>(() => `${CLAIMS_URL}/alerts`);
  protected readonly urgent = computed(() =>
    this.alerts.hasValue() ? this.alerts.value().length : 0,
  );

  protected readonly states = CLAIM_STATES;
  protected readonly stateLabels = CLAIM_STATE_LABELS;
  protected readonly typeLabels = CLAIM_TYPE_LABELS;
  protected readonly formatCode = formatCode;
  protected readonly deadlineLabel = deadlineLabel;
  protected readonly isPending = isPending;

  protected file(): void {
    this.dialog
      .open<ClaimFormDialog, void, Claim>(ClaimFormDialog, { width: '560px' })
      .afterClosed()
      .subscribe((filed) => {
        if (filed) {
          void this.router.navigate(['/pqr', filed.id]);
        }
      });
  }
}
