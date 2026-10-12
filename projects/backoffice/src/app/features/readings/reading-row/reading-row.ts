import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Invoice } from '../../invoices/invoice.models';
import { ServiceType } from '../../organizations/organization.models';
import { formatCode } from '../../subscribers/subscriber.models';
import { Reading, RouteEntry } from '../reading.models';
import { ReadingsApi } from '../readings-api';

/**
 * Un medidor de la ruta: muestra la lectura anterior y captura la actual. Se guarda con Enter o con el botón, y
 * muestra de inmediato el consumo y si es inusual. Cada fila guarda por separado para no perder lo ya digitado
 * si falla una.
 */
@Component({
  selector: 'aq-reading-row',
  imports: [
    CurrencyPipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './reading-row.html',
  styleUrl: './reading-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingRow {
  private readonly api = inject(ReadingsApi);

  readonly entry = input.required<RouteEntry>();
  readonly periodId = input.required<string>();
  readonly serviceType = input.required<ServiceType>();
  readonly unit = input('m³');
  /** Periodo abierto y rol con permiso: se puede digitar. */
  readonly editable = input(false);
  /** Factura generada por la lectura guardada, si ya se cargó. */
  readonly invoice = input<Invoice | null>(null);

  /** Lectura guardada o eliminada (`null`). */
  readonly changed = output<Reading | null>();

  /** Valor digitado; parte de la lectura ya guardada, si existe. */
  protected readonly current = linkedSignal<number | null>(
    () => this.entry().reading?.currentReading ?? null,
  );
  /** Lectura inicial: primera vez que se lee el predio, o medidor nuevo. */
  protected readonly initial = linkedSignal<number>(
    () => this.entry().reading?.previousReading ?? 0,
  );
  protected readonly meterReplaced = linkedSignal(
    () => this.entry().reading?.meterReplaced ?? false,
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Sin historial o con medidor nuevo, la lectura anterior la indica quien digita. */
  protected readonly needsInitial = computed(
    () => this.entry().previousReading === null || this.meterReplaced(),
  );
  protected readonly previous = computed(() =>
    this.needsInitial() ? this.initial() : (this.entry().previousReading ?? 0),
  );
  protected readonly saved = computed(() => this.entry().reading);
  protected readonly dirty = computed(() => {
    const saved = this.saved();
    return (
      this.current() !== (saved?.currentReading ?? null) ||
      this.meterReplaced() !== (saved?.meterReplaced ?? false) ||
      (saved !== null && this.needsInitial() && this.initial() !== saved.previousReading)
    );
  });
  protected readonly formatCode = formatCode;

  protected toggleMeterReplaced(): void {
    this.meterReplaced.update((value) => !value);
    this.error.set(null);
  }

  protected save(): void {
    const current = this.current();
    if (current === null || Number.isNaN(current) || !this.editable() || this.saving()) {
      return;
    }
    if (current < this.previous()) {
      this.error.set(this.lowerThanPrevious());
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api
      .record(this.periodId(), {
        propertyId: this.entry().propertyId,
        serviceType: this.serviceType(),
        currentReading: current,
        previousReading: this.needsInitial() ? this.initial() : undefined,
        meterReplaced: this.meterReplaced() || undefined,
      })
      .subscribe({
        next: (reading) => {
          this.saving.set(false);
          this.changed.emit(reading);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), {
              403: 'Tu rol solo permite consultar.',
              422:
                'No se pudo guardar: la lectura es menor que la anterior, su factura ya está pagada o ' +
                'el servicio no tiene tarifa vigente.',
            }),
          );
        },
      });
  }

  protected remove(): void {
    const saved = this.saved();
    if (!saved || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api.delete(saved.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.changed.emit(null);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            422: 'No se puede eliminar: el periodo está cerrado o su factura ya está pagada.',
          }),
        );
      },
    });
  }

  private lowerThanPrevious(): string {
    return `La lectura no puede ser menor que la anterior (${this.previous()}). Si se cambió el medidor, márcalo.`;
  }
}
