import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SessionStore } from '../../../core/auth/session-store';
import { Notifier } from '../../../core/ui/notifier';
import { ALTITUDE_LABELS } from '../../regulatory/regulatory.models';
import { ServiceAreaDialog } from '../service-area-dialog/service-area-dialog';
import { SERVICE_AREAS_URL, ServiceArea } from '../service-area.models';

/** Áreas de prestación del prestador. Son opcionales: quien tiene una sola no las registra. */
@Component({
  selector: 'aq-service-area-list',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>Áreas de prestación</h1>
          <span class="muted">
            Opcionales. Un predio de un área se factura con la tarifa de su área o, si no tiene, con
            la general.
          </span>
        </div>
        @if (session.canAdministerOrganization()) {
          <button mat-flat-button (click)="open()">
            <mat-icon>add</mat-icon>
            Nueva área
          </button>
        }
      </header>

      @if (areas.isLoading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Cargando áreas" />
      }
      @if (areas.error()) {
        <div class="state" role="alert">
          <p>No pudimos cargar las áreas.</p>
          <button mat-stroked-button (click)="areas.reload()">Reintentar</button>
        </div>
      } @else if (areas.hasValue()) {
        @for (area of areas.value(); track area.id) {
          <mat-card appearance="outlined" class="area">
            <mat-card-content class="row">
              <div>
                <strong>{{ area.name }}</strong>
                <div class="muted">
                  {{ area.municipalityCode ? 'Municipio ' + area.municipalityCode : 'Sin municipio' }}
                  ·
                  {{
                    area.altitudeBand
                      ? altitudeLabels[area.altitudeBand]
                      : 'Altitud del perfil regulatorio'
                  }}
                </div>
              </div>
              @if (session.canAdministerOrganization()) {
                <button
                  mat-icon-button
                  (click)="open(area)"
                  [attr.aria-label]="'Editar área ' + area.name"
                >
                  <mat-icon>edit</mat-icon>
                </button>
              }
            </mat-card-content>
          </mat-card>
        } @empty {
          <div class="state">
            <mat-icon aria-hidden="true">map</mat-icon>
            <p>No hay áreas registradas: todos los predios usan la tarifa general.</p>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .area {
      margin-bottom: 8px;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
  `,
})
export class ServiceAreaList {
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  protected readonly areas = httpResource<ServiceArea[]>(() => SERVICE_AREAS_URL);
  protected readonly altitudeLabels = ALTITUDE_LABELS;

  protected open(area?: ServiceArea): void {
    this.dialog
      .open<ServiceAreaDialog, ServiceArea | undefined, ServiceArea>(ServiceAreaDialog, {
        data: area,
        width: '480px',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.areas.reload();
          this.notifier.success(area ? 'Área actualizada' : 'Área creada');
        }
      });
  }
}
