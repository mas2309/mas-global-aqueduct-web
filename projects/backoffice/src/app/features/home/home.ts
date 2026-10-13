import { CurrencyPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../core/auth/session-store';
import { ROLE_LABELS } from '../../core/i18n/labels';
import { periodLabel } from '../readings/reading.models';
import { ConsolidatedSummary, REPORTS_URL } from '../reports/report.models';

/**
 * Inicio: el prestador de la sesión y cómo va su facturación, su recaudo y su cartera. Si es una ESP o municipio
 * con prestadores vinculados, también las cifras de cada uno y el total.
 */
@Component({
  selector: 'aq-home',
  imports: [CurrencyPipe, MatCardModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly session = inject(SessionStore);
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly periodLabel = periodLabel;
  protected readonly firstName = computed(() => this.session.user()?.fullName.split(' ')[0] ?? '');

  /** Solo con un prestador seleccionado; se vuelve a consultar al cambiar de prestador. */
  protected readonly summary = httpResource<ConsolidatedSummary>(() =>
    this.session.organization()?.organizationId ? `${REPORTS_URL}/consolidated` : undefined,
  );
}
