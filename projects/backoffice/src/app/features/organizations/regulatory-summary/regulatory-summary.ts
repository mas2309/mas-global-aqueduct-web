import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import {
  FRAMEWORK_LABELS,
  RegulatoryProfile,
  SEGMENT_LABELS,
} from '../../regulatory/regulatory.models';
import { ORGANIZATIONS_URL } from '../organizations-api';

/** Marco regulatorio de un prestador en su ficha, con el acceso para gestionarlo. */
@Component({
  selector: 'aq-regulatory-summary',
  imports: [RouterLink, MatButtonModule, MatCardModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Perfil regulatorio</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if (profile.error()) {
          <p class="error" role="alert">No pudimos cargar su perfil regulatorio.</p>
        } @else if (profile.hasValue()) {
          @let current = profile.value();
          <p>
            {{ frameworkLabels[current.framework] }}
            @if (current.classification; as classification) {
              · segmento {{ segmentLabels[classification.segment] }}, subsegmento
              {{ classification.subsegment }}
            }
          </p>
          @if (current.usesServiceAreas) {
            <p class="muted">Con áreas de prestación</p>
          }
          <a
            mat-stroked-button
            [routerLink]="['/prestadores', organizationId(), 'perfil-regulatorio']"
          >
            Gestionar perfil
          </a>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    mat-card {
      margin-top: 16px;
    }
    mat-card-content {
      padding-top: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegulatorySummary {
  readonly organizationId = input.required<string>();

  protected readonly profile = httpResource<RegulatoryProfile>(
    () => `${ORGANIZATIONS_URL}/${this.organizationId()}/regulatory-profile`,
  );
  protected readonly frameworkLabels = FRAMEWORK_LABELS;
  protected readonly segmentLabels = SEGMENT_LABELS;
}
