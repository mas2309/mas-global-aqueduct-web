import { CurrencyPipe } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session-store';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { formatCode } from '../../subscribers/subscriber.models';
import {
  Candidate,
  DISCONNECTIONS_URL,
  DisconnectionRules,
  SERVICE_ACTION_LABELS,
  ServiceEvent,
} from '../disconnection.models';
import {
  ServiceActionData,
  ServiceActionDialog,
} from '../service-action-dialog/service-action-dialog';

/**
 * Acometidas que según las reglas del prestador deberían suspenderse o cortarse, y esas reglas. El sistema solo
 * sugiere: la acción se ejecuta en el predio y luego se registra.
 */
@Component({
  selector: 'aq-disconnections-page',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './disconnections-page.html',
  styles: `
    .candidates {
      width: 100%;
      border-collapse: collapse;

      th,
      td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
    mat-card {
      margin-bottom: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisconnectionsPage {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  protected readonly rules = httpResource<DisconnectionRules>(() => `${DISCONNECTIONS_URL}/rules`);
  protected readonly candidates = httpResource<Candidate[]>(
    () => `${DISCONNECTIONS_URL}/candidates`,
  );
  /** Sin periodos configurados el sistema no sugiere nada. */
  protected readonly suggests = computed(() => {
    const rules = this.rules.hasValue() ? this.rules.value() : null;
    return (rules?.suspendAfterUnpaidPeriods ?? rules?.cutAfterUnpaidPeriods ?? null) !== null;
  });

  protected readonly form = this.fb.group({
    suspendAfterUnpaidPeriods: this.fb.control<number | null>(null, [
      Validators.min(1),
      Validators.max(120),
    ]),
    cutAfterUnpaidPeriods: this.fb.control<number | null>(null, [
      Validators.min(1),
      Validators.max(120),
    ]),
    reconnectionFee: [0, [Validators.required, Validators.min(0)]],
    reinstatementFee: [0, [Validators.required, Validators.min(0)]],
    paymentRequiredToRestore: [true],
    /** Una causal por línea. */
    causes: ['', [Validators.required, Validators.pattern(/\S/)]],
  });
  protected readonly saving = signal(false);

  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly actionLabels = SERVICE_ACTION_LABELS;
  protected readonly formatCode = formatCode;

  constructor() {
    effect(() => {
      if (this.rules.hasValue()) {
        const rules = this.rules.value();
        untracked(() => this.form.patchValue({ ...rules, causes: rules.causes.join('\n') }));
      }
    });
    effect(() => {
      if (this.session.canAdministerOrganization()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  protected register(candidate: Candidate): void {
    const cut = candidate.action === 'CUT';
    const data: ServiceActionData = {
      propertyId: candidate.propertyId,
      address: candidate.address,
      serviceType: candidate.serviceType,
      action: cut ? 'CUT' : 'SUSPEND',
      title: cut ? 'Cortar' : 'Suspender',
    };
    this.dialog
      .open<ServiceActionDialog, ServiceActionData, ServiceEvent>(ServiceActionDialog, {
        data,
        width: '480px',
      })
      .afterClosed()
      .subscribe((event) => {
        if (event) {
          this.candidates.reload();
          this.notifier.success(`${this.actionLabels[event.action]} registrada`);
        }
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: DisconnectionRules = {
      ...value,
      causes: value.causes
        .split('\n')
        .map((cause) => cause.trim())
        .filter((cause) => cause.length > 0),
    };
    this.saving.set(true);
    this.http.put<DisconnectionRules>(`${DISCONNECTIONS_URL}/rules`, request).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.rules.set(saved);
        this.candidates.reload();
        this.notifier.success('Reglas guardadas');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.notifier.apiError(error, {
          400: 'Revisa las reglas: el corte no puede ir antes de la suspensión.',
          403: 'Solo el administrador del prestador cambia las reglas.',
        });
      },
    });
  }
}
