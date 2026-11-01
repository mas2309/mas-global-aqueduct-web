import { HttpClient } from '@angular/common/http';
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { SessionStore } from '../../../core/auth/session-store';
import { Notifier } from '../../../core/ui/notifier';
import {
  ALTITUDE_BANDS,
  ALTITUDE_LABELS,
  AltitudeBand,
  FRAMEWORK_LABELS,
  FRAMEWORKS,
  REGULATORY_PROFILE_URL,
  RegulatoryFramework,
  RegulatoryProfile,
  RegulatoryProfileRequest,
  RegulatoryRules,
  STRATIFICATION_LABELS,
  STRATIFICATION_SOURCES,
  StratificationSource,
} from '../regulatory.models';
import { RegulatoryStatus } from '../regulatory-status';

const STRATA = [1, 2, 3, 4, 5, 6] as const;

/**
 * Marco regulatorio del prestador y reglas que se derivan de él. Al cambiar de marco o altitud se proponen los valores
 * por defecto de la norma; todos se pueden ajustar antes de guardar. Solo el administrador cambia algo.
 */
@Component({
  selector: 'aq-regulatory-profile',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './regulatory-profile.html',
  styles: `
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
    mat-card {
      margin-bottom: 16px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegulatoryProfilePage {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notifier = inject(Notifier);
  private readonly session = inject(SessionStore);

  /** El mismo que usa el menú: al guardar, el menú se actualiza. */
  protected readonly profile = inject(RegulatoryStatus).profile;
  protected readonly canEdit = computed(() => this.session.canAdministerOrganization());
  protected readonly saving = signal(false);

  protected readonly frameworks = FRAMEWORKS;
  protected readonly frameworkLabels = FRAMEWORK_LABELS;
  protected readonly altitudes = ALTITUDE_BANDS;
  protected readonly altitudeLabels = ALTITUDE_LABELS;
  protected readonly sources = STRATIFICATION_SOURCES;
  protected readonly sourceLabels = STRATIFICATION_LABELS;
  protected readonly strata = STRATA;

  protected readonly form = this.fb.group({
    framework: this.fb.control<RegulatoryFramework>('NONE'),
    altitudeBand: this.fb.control<AltitudeBand | null>(null),
    stratificationSource: this.fb.control<StratificationSource | null>(null),
    census: this.fb.group({
      waterSubscribers: this.fb.control<number | null>(null, [Validators.min(0)]),
      sewerageSubscribers: this.fb.control<number | null>(null, [Validators.min(0)]),
      ruralMajority: [false],
      onlyRural: [false],
      communityManager: [false],
      communityInFirstSegment: [false],
    }),
    rules: this.fb.group({
      basicConsumption: this.fb.control<number | null>(null, [Validators.min(0.001)]),
      caps: this.fb.group({
        s1: this.cap(),
        s2: this.cap(),
        s3: this.cap(),
        s4: this.cap(),
        s5: this.cap(),
        s6: this.cap(),
      }),
      deviation: this.fb.group({
        threshold: [40, [Validators.required, Validators.min(0)]],
        percentAtOrAbove: [35, [Validators.required, Validators.min(0.01), Validators.max(1000)]],
        percentBelow: [65, [Validators.required, Validators.min(0.01), Validators.max(1000)]],
        historyMonths: [6, [Validators.required, Validators.min(1), Validators.max(24)]],
        reviewRequired: [false],
      }),
      minDeliveryDaysBeforeDue: this.fb.control<number | null>(null, [
        Validators.min(1),
        Validators.max(60),
      ]),
      legalInvoiceContent: [false],
      reportsToSui: [false],
    }),
  });

  constructor() {
    effect(() => {
      if (this.profile.hasValue()) {
        const profile = this.profile.value();
        untracked(() => this.fill(profile));
      }
    });
    effect(() => {
      if (this.canEdit()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  protected get regulated(): boolean {
    return this.form.controls.framework.value !== 'NONE';
  }

  protected get needsCensus(): boolean {
    return this.form.controls.framework.value === 'SMALL_PROVIDERS';
  }

  /** Propone los valores de la norma para el marco y la altitud elegidos. */
  protected applyPreset(): void {
    const { framework, altitudeBand } = this.form.getRawValue();
    const params: Record<string, string> = altitudeBand
      ? { framework, altitudeBand }
      : { framework };
    this.http.get<RegulatoryRules>(`${REGULATORY_PROFILE_URL}/presets`, { params }).subscribe({
      next: (rules) => this.fillRules(rules),
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.http.put<RegulatoryProfile>(REGULATORY_PROFILE_URL, this.request()).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.profile.set(saved);
        this.notifier.success('Perfil regulatorio guardado');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.notifier.apiError(error, {
          403: 'Solo el administrador del prestador cambia el perfil regulatorio.',
          422:
            'No se pudo guardar: un marco regulado exige la altitud, el de pequeños prestadores exige sus ' +
            'condiciones, y estas solo se fijan una vez.',
        });
      },
    });
  }

  private cap() {
    return this.fb.control<number | null>(null, [Validators.min(0), Validators.max(100)]);
  }

  private fill(profile: RegulatoryProfile): void {
    this.form.patchValue({
      framework: profile.framework,
      altitudeBand: profile.altitudeBand,
      stratificationSource: profile.stratificationSource,
    });
    if (profile.census) {
      this.form.controls.census.patchValue(profile.census);
    }
    this.fillRules(profile.rules);
  }

  private fillRules(rules: RegulatoryRules): void {
    this.form.controls.rules.patchValue({
      basicConsumption: rules.basicConsumption,
      caps: {
        s1: rules.subsidyCaps['1'] ?? null,
        s2: rules.subsidyCaps['2'] ?? null,
        s3: rules.subsidyCaps['3'] ?? null,
        s4: rules.subsidyCaps['4'] ?? null,
        s5: rules.subsidyCaps['5'] ?? null,
        s6: rules.subsidyCaps['6'] ?? null,
      },
      deviation: rules.deviation,
      minDeliveryDaysBeforeDue: rules.minDeliveryDaysBeforeDue,
      legalInvoiceContent: rules.legalInvoiceContent,
      reportsToSui: rules.reportsToSui,
    });
  }

  private request(): RegulatoryProfileRequest {
    const value = this.form.getRawValue();
    const { caps, ...rules } = value.rules;
    const subsidyCaps: Record<string, number> = {};
    for (const stratum of STRATA) {
      const cap = caps[`s${stratum}`];
      if (cap !== null) {
        subsidyCaps[String(stratum)] = cap;
      }
    }
    const census = value.census;
    return {
      framework: value.framework,
      altitudeBand: value.altitudeBand,
      stratificationSource: value.stratificationSource,
      census:
        this.needsCensus && census.waterSubscribers !== null && census.sewerageSubscribers !== null
          ? {
              ...census,
              waterSubscribers: census.waterSubscribers,
              sewerageSubscribers: census.sewerageSubscribers,
            }
          : null,
      rules: { ...rules, subsidyCaps },
    };
  }
}
