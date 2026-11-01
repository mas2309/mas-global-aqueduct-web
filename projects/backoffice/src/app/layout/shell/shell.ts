import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { OrganizationAccess } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { SessionStore } from '../../core/auth/session-store';
import { ROLE_LABELS } from '../../core/i18n/labels';
import { Notifier } from '../../core/ui/notifier';
import { RegulatoryStatus } from '../../features/regulatory/regulatory-status';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/** Estructura de la aplicación: barra superior con el prestador actual, menú lateral y contenido. */
@Component({
  selector: 'aq-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);
  protected readonly regulatory = inject(RegulatoryStatus);
  protected readonly roleLabels = ROLE_LABELS;

  /** En pantallas pequeñas el menú lateral se superpone y se cierra al navegar. */
  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly navigation = computed<NavItem[]>(() => {
    const items: NavItem[] = [];
    if (this.session.organization()) {
      items.push({ path: '/inicio', label: 'Inicio', icon: 'home' });
      items.push({ path: '/suscriptores', label: 'Suscriptores', icon: 'groups' });
      items.push({ path: '/lecturas', label: 'Lecturas', icon: 'speed' });
      items.push({ path: '/facturas', label: 'Facturas', icon: 'receipt_long' });
      items.push({ path: '/financiaciones', label: 'Financiaciones', icon: 'event_repeat' });
      items.push({ path: '/tarifas', label: 'Tarifas', icon: 'payments' });
      items.push({ path: '/pqr', label: 'PQR', icon: 'forum' });
      items.push({ path: '/cortes', label: 'Suspensión y corte', icon: 'content_cut' });
      if (this.regulatory.reportsToSui()) {
        items.push({ path: '/sui', label: 'Archivos SUI', icon: 'upload_file' });
      }
      items.push({ path: '/areas', label: 'Áreas de prestación', icon: 'map' });
      if (this.regulatory.regulated()) {
        items.push({ path: '/perfil-regulatorio', label: 'Perfil regulatorio', icon: 'gavel' });
      }
      items.push({ path: '/finanzas', label: 'Ingresos y gastos', icon: 'account_balance_wallet' });
      items.push({ path: '/informes', label: 'Informes', icon: 'bar_chart' });
      items.push({ path: '/documentos', label: 'Documentos', icon: 'folder_open' });
    }
    if (this.session.organization() && this.session.canAdministerOrganization()) {
      items.push({ path: '/usuarios', label: 'Usuarios', icon: 'group' });
    }
    if (this.session.isPlatformAdmin()) {
      items.push({ path: '/prestadores', label: 'Prestadores', icon: 'apartment' });
      items.push({ path: '/liquidaciones', label: 'Liquidación de MAS', icon: 'request_quote' });
    }
    return items;
  });

  protected closeIfCompact(sidenav: MatSidenav): void {
    if (this.compact()) {
      void sidenav.close();
    }
  }

  protected switchTo(access: OrganizationAccess): void {
    if (access.organizationId === this.session.organization()?.organizationId) {
      return;
    }
    this.auth.selectOrganization(access.organizationId).subscribe({
      next: () => {
        this.notifier.success(`Ahora trabajas en ${access.name}`);
        void this.router.navigateByUrl('/inicio');
      },
      error: (error: unknown) =>
        this.notifier.apiError(error, { 403: 'Ya no tienes acceso a este prestador.' }),
    });
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
