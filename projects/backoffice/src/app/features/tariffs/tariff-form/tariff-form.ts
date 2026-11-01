import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { ServiceType } from '../../organizations/organization.models';
import {
  METERED_SERVICES,
  PROPERTY_USAGE_LABELS,
  PROPERTY_USAGES,
  PropertyUsage,
  STRATA,
} from '../../subscribers/subscriber.models';
import { Tariff, TariffRequest, unitOf } from '../tariff.models';
import { TARIFFS_URL, TariffsApi } from '../tariffs-api';

type AdjustmentKind = 'SUBSIDY' | 'CONTRIBUTION';

function blockGroup(fb: NonNullableFormBuilder, upTo: number | null, pricePerUnit: number) {
  return fb.group({
    upTo: [upTo, [Validators.required, Validators.min(0.001)]],
    pricePerUnit: [pricePerUnit, [Validators.required, Validators.min(0)]],
  });
}

function adjustmentGroup(
  fb: NonNullableFormBuilder,
  usage: PropertyUsage,
  stratum: number,
  kind: AdjustmentKind,
  percent: number,
) {
  return fb.group({
    usage: [usage],
    stratum: [stratum],
    kind: [kind],
    percent: [percent, [Validators.required, Validators.min(0.01), Validators.max(100)]],
  });
}

type BlockGroup = ReturnType<typeof blockGroup>;
type AdjustmentGroup = ReturnType<typeof adjustmentGroup>;

/** Primer día del mes siguiente: lo habitual es que una tarifa nueva empiece con el próximo periodo. */
function firstDayOfNextMonth(): string {
  const now = new Date();
  const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const month = ((now.getMonth() + 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Nueva versión de la tarifa de un servicio. Parte de una copia de la vigente para que subir precios sea cambiar
 * unos números y la fecha, sin volver a escribir los rangos.
 */
@Component({
  selector: 'aq-tariff-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './tariff-form.html',
  styleUrl: './tariff-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TariffForm {
  private readonly api = inject(TariffsApi);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);
  private readonly fb = inject(NonNullableFormBuilder);
  /** Agregar o quitar filas de un FormArray no es una señal: hay que pedir el repintado. */
  private readonly changeDetector = inject(ChangeDetectorRef);

  /** Servicio de la tarifa (query param `servicio`). */
  readonly servicio = input<ServiceType>('WATER');
  /** Área de la tarifa (query param `area`); sin ella es la tarifa general. */
  readonly area = input<string>();

  protected readonly metered = computed(() => METERED_SERVICES.has(this.servicio()));
  protected readonly unit = computed(() => unitOf(this.servicio()));
  protected readonly serviceLabel = computed(() => SERVICE_LABELS[this.servicio()].toLowerCase());
  private readonly existing = httpResource<Tariff[]>(() => ({
    url: TARIFFS_URL,
    params: { serviceType: this.servicio() },
  }));

  protected readonly usages = PROPERTY_USAGES;
  protected readonly usageLabels = PROPERTY_USAGE_LABELS;
  protected readonly strata = STRATA;

  protected readonly form = this.fb.group({
    validFrom: [firstDayOfNextMonth(), Validators.required],
    fixedCharge: [0, [Validators.required, Validators.min(0)]],
    /** Rangos con límite, en orden. El último rango (sin límite) usa `lastPrice`. */
    blocks: this.fb.array<BlockGroup>([]),
    lastPrice: [0, [Validators.required, Validators.min(0)]],
    adjustments: this.fb.array<AdjustmentGroup>([]),
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private prefilled = false;

  constructor() {
    // Copia la tarifa más reciente como punto de partida, una sola vez
    effect(() => {
      if (!this.existing.hasValue() || this.prefilled) {
        return;
      }
      const latest = this.existing
        .value()
        .find((tariff) => (tariff.serviceAreaId ?? undefined) === this.area());
      untracked(() => {
        this.prefilled = true;
        if (latest) {
          this.copy(latest);
        }
      });
    });
  }

  protected get blocks(): FormArray<BlockGroup> {
    return this.form.controls.blocks;
  }

  protected get adjustments(): FormArray<AdjustmentGroup> {
    return this.form.controls.adjustments;
  }

  protected addBlock(): void {
    const last = this.blocks.at(this.blocks.length - 1)?.controls.upTo.value ?? 0;
    this.blocks.push(blockGroup(this.fb, (last ?? 0) + 10, this.form.controls.lastPrice.value));
    this.changeDetector.markForCheck();
  }

  protected removeBlock(index: number): void {
    this.blocks.removeAt(index);
    this.changeDetector.markForCheck();
  }

  protected addAdjustment(): void {
    this.adjustments.push(adjustmentGroup(this.fb, 'RESIDENTIAL', 1, 'SUBSIDY', 10));
    this.changeDetector.markForCheck();
  }

  protected removeAdjustment(index: number): void {
    this.adjustments.removeAt(index);
    this.changeDetector.markForCheck();
  }

  /** Desde qué consumo aplica el rango: el límite del anterior. */
  protected lowerLimit(index: number): number {
    return index === 0 ? 0 : (this.blocks.at(index - 1).controls.upTo.value ?? 0);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const limits = value.blocks.map((block) => block.upTo ?? 0);
    if (limits.some((limit, index) => limit <= (index === 0 ? 0 : limits[index - 1]))) {
      this.error.set('Los límites de los rangos deben ir de menor a mayor.');
      return;
    }
    const request: TariffRequest = {
      serviceType: this.servicio(),
      serviceAreaId: this.area(),
      validFrom: value.validFrom,
      fixedCharge: value.fixedCharge,
      blocks: this.metered()
        ? [
            ...value.blocks.map((block) => ({
              upTo: block.upTo,
              pricePerUnit: block.pricePerUnit,
            })),
            { upTo: null, pricePerUnit: value.lastPrice },
          ]
        : [],
      adjustments: value.adjustments.map((adjustment) => ({
        usage: adjustment.usage,
        stratum: adjustment.usage === 'RESIDENTIAL' ? adjustment.stratum : null,
        percent: adjustment.kind === 'SUBSIDY' ? -adjustment.percent : adjustment.percent,
      })),
    };
    this.saving.set(true);
    this.error.set(null);
    this.api.create(request).subscribe({
      next: (tariff) => {
        this.notifier.success(
          tariff.inEffect ? 'Tarifa guardada: ya está vigente' : 'Tarifa programada',
        );
        void this.router.navigate(['/tarifas'], { queryParams: { servicio: this.servicio() } });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.notifier.apiError(error, {
          400: 'Revisa la tarifa: hay un uso y estrato repetido, o un valor no válido.',
          403: 'Solo el administrador del prestador puede cambiar las tarifas.',
          409: 'Ya existe una tarifa de este servicio con esa fecha de vigencia.',
          422: 'El prestador no ofrece este servicio.',
        });
      },
    });
  }

  private copy(tariff: Tariff): void {
    this.form.controls.fixedCharge.setValue(tariff.fixedCharge);
    tariff.blocks
      .filter((block) => block.upTo !== null)
      .forEach((block) => this.blocks.push(blockGroup(this.fb, block.upTo, block.pricePerUnit)));
    this.form.controls.lastPrice.setValue(tariff.blocks.at(-1)?.pricePerUnit ?? 0);
    tariff.adjustments.forEach((adjustment) =>
      this.adjustments.push(
        adjustmentGroup(
          this.fb,
          adjustment.usage,
          adjustment.stratum ?? 1,
          adjustment.percent < 0 ? 'SUBSIDY' : 'CONTRIBUTION',
          Math.abs(adjustment.percent),
        ),
      ),
    );
    this.changeDetector.markForCheck();
  }
}
