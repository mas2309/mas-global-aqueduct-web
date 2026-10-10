import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../core/auth/session-store';
import { ROLE_LABELS } from '../../core/i18n/labels';

/** Próximos módulos según el plan de trabajo, para que el equipo vea hacia dónde va la plataforma. */
const UPCOMING = [
  { icon: 'groups', title: 'Suscriptores y predios', sprint: 'Sprint 2' },
  { icon: 'speed', title: 'Tarifas y lecturas', sprint: 'Sprint 3' },
  { icon: 'receipt_long', title: 'Facturación', sprint: 'Sprint 4' },
  { icon: 'qr_code_2', title: 'Portal QR y pagos en línea', sprint: 'Sprint 5' },
];

@Component({
  selector: 'aq-home',
  imports: [MatCardModule, MatIconModule, MatButtonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly session = inject(SessionStore);
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly upcoming = UPCOMING;
  protected readonly firstName = computed(() => this.session.user()?.fullName.split(' ')[0] ?? '');
}
