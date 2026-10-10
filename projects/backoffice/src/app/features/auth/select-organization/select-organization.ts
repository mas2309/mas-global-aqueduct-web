import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Router, RouterLink } from '@angular/router';
import { OrganizationAccess } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { SessionStore } from '../../../core/auth/session-store';
import { ROLE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';

/** El usuario elige con qué prestador trabajar. Cambiar después se hace desde la barra superior. */
@Component({
  selector: 'aq-select-organization',
  imports: [MatListModule, MatIconModule, MatChipsModule, MatButtonModule, RouterLink],
  templateUrl: './select-organization.html',
  styleUrl: './select-organization.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectOrganization {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly selecting = signal<string | null>(null);

  protected select(access: OrganizationAccess): void {
    this.selecting.set(access.organizationId);
    this.auth.selectOrganization(access.organizationId).subscribe({
      next: () => void this.router.navigateByUrl('/inicio'),
      error: (error: unknown) => {
        this.selecting.set(null);
        this.notifier.apiError(error, { 403: 'Ya no tienes acceso a este prestador.' });
      },
    });
  }
}
