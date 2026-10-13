import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { filter, switchMap } from 'rxjs';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { PortalLink as Link } from '../subscriber.models';
import { SUBSCRIBERS_URL, SubscribersApi } from '../subscribers-api';

/**
 * Enlace del portal público del suscriptor: el mismo del QR de sus facturas. Desde aquí se copia para enviarlo
 * y se cambia si una factura impresa se pierde. Se muestra en la ficha del suscriptor.
 */
@Component({
  selector: 'aq-portal-link',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section-header">
      <h2>Portal del suscriptor</h2>
    </div>
    @if (link.error()) {
      <p class="muted" role="alert">No pudimos cargar el enlace del portal.</p>
    } @else if (link.hasValue()) {
      @if (link.value().url; as url) {
        <p class="muted">
          Con este enlace, que también va en el código QR de sus facturas, el suscriptor consulta su
          historial sin iniciar sesión.
        </p>
        <div class="link">
          <a [href]="url" target="_blank" rel="noopener">{{ url }}</a>
          <button mat-button (click)="copy(url)">
            <mat-icon>content_copy</mat-icon>
            Copiar
          </button>
          @if (editable()) {
            <button mat-button (click)="rotate()">
              <mat-icon>autorenew</mat-icon>
              Cambiar enlace
            </button>
          }
        </div>
      } @else {
        <p class="muted">El portal de consulta no está configurado en este ambiente.</p>
      }
    }
  `,
  styles: `
    .link {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      a {
        flex: 1;
        min-width: 240px;
        overflow-wrap: anywhere;
        color: var(--mat-sys-primary);
      }
    }
  `,
})
export class PortalLink {
  private readonly api = inject(SubscribersApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);

  readonly subscriberId = input.required<string>();
  /** El rol permite cambiar el enlace. */
  readonly editable = input(false);

  protected readonly link = httpResource<Link>(
    () => `${SUBSCRIBERS_URL}/${this.subscriberId()}/portal-link`,
  );

  protected copy(url: string): void {
    navigator.clipboard.writeText(url).then(
      () => this.notifier.success('Enlace copiado'),
      () => this.notifier.error('No se pudo copiar: selecciona el enlace y cópialo a mano.'),
    );
  }

  protected rotate(): void {
    const data: ConfirmDialogData = {
      title: 'Cambiar el enlace del portal',
      message:
        'El enlace actual y el código QR de las facturas ya impresas dejan de funcionar. ' +
        'Las facturas que se impriman desde ahora llevan el nuevo.',
      confirmLabel: 'Cambiar enlace',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.api.rotatePortalLink(this.subscriberId())),
      )
      .subscribe({
        next: (rotated) => {
          this.link.set(rotated);
          this.notifier.success('Enlace del portal cambiado');
        },
        error: (error: unknown) =>
          this.notifier.apiError(error, { 403: 'Tu rol solo permite consultar.' }),
      });
  }
}
