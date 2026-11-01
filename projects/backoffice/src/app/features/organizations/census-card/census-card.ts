import { HttpClient, httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { filter, switchMap } from 'rxjs';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { FRAMEWORK_LABELS, RegulatoryProfile } from '../../regulatory/regulatory.models';
import { ORGANIZATIONS_URL } from '../organizations-api';

/**
 * Condiciones CRA 1038 de un prestador, para el administrador de plataforma. El prestador las fija una sola vez; aquí
 * solo se corrige un error. No muestra ninguna otra regla ni dato del prestador.
 */
@Component({
  selector: 'aq-census-card',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './census-card.html',
  styles: `
    mat-card {
      margin-top: 16px;
    }
    mat-card-content {
      padding-top: 12px;
    }
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 4px 12px;
    }
    .checks {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CensusCard {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);

  readonly organizationId = input.required<string>();

  protected readonly profile = httpResource<RegulatoryProfile>(
    () => `${ORGANIZATIONS_URL}/${this.organizationId()}/regulatory-profile`,
  );
  protected readonly frameworkLabels = FRAMEWORK_LABELS;
  protected readonly saving = signal(false);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    waterSubscribers: this.fb.control(0, [Validators.required, Validators.min(0)]),
    sewerageSubscribers: this.fb.control(0, [Validators.required, Validators.min(0)]),
    ruralMajority: [false],
    onlyRural: [false],
    communityManager: [false],
    communityInFirstSegment: [false],
  });

  constructor() {
    effect(() => {
      const census = this.profile.hasValue() ? this.profile.value().census : null;
      if (census) {
        untracked(() => this.form.reset(census));
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Corregir condiciones',
          message:
            'Cambia la clasificación CRA 1038 del prestador. Hazlo solo para corregir un error en sus condiciones al 31 de diciembre de 2024.',
          confirmLabel: 'Corregir',
        },
        width: '440px',
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => {
          this.saving.set(true);
          return this.http.put<RegulatoryProfile>(
            `${ORGANIZATIONS_URL}/${this.organizationId()}/regulatory-census`,
            this.form.getRawValue(),
          );
        }),
      )
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.profile.set(saved);
          this.notifier.success('Condiciones corregidas');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.notifier.apiError(error, {
            400: 'No se pudo corregir: las condiciones no corresponden al marco regulatorio del prestador.',
          });
        },
      });
  }
}
