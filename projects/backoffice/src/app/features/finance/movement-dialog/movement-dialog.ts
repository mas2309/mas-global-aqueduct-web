import { MoneyInput } from '../../../shared/ui/money-input';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Observable, of, switchMap } from 'rxjs';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { isoDate } from '../../reports/report.models';
import { FinanceApi } from '../finance-api';
import {
  attachmentProblem,
  CATEGORY_SUGGESTIONS,
  Movement,
  MovementRequest,
  MOVEMENTS_URL,
} from '../finance.models';

/** Registra o corrige un ingreso o un gasto, con su soporte opcional. Devuelve el movimiento guardado. */
@Component({
  selector: 'aq-movement-dialog',
  imports: [
    MoneyInput,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
  ],
  templateUrl: './movement-dialog.html',
  styleUrl: './movement-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementDialog {
  private readonly api = inject(FinanceApi);
  private readonly dialogRef = inject<MatDialogRef<MovementDialog, Movement>>(MatDialogRef);
  /** El movimiento a corregir; `null` para registrar uno nuevo. */
  protected readonly movement = inject<Movement | null>(MAT_DIALOG_DATA);

  protected readonly form = inject(NonNullableFormBuilder).group({
    type: [this.movement?.type ?? 'EXPENSE', Validators.required],
    date: [this.movement?.date ?? isoDate(new Date()), Validators.required],
    category: [this.movement?.category ?? '', [Validators.required, Validators.maxLength(60)]],
    description: [
      this.movement?.description ?? '',
      [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)],
    ],
    amount: [this.movement?.amount ?? 0, [Validators.required, Validators.min(1)]],
  });
  private readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  private readonly category = toSignal(this.form.controls.category.valueChanges, {
    initialValue: this.form.controls.category.value,
  });
  /** Las categorías que el prestador ya usa en este tipo, de la más usada a la menos. */
  private readonly used = httpResource<string[]>(() => ({
    url: `${MOVEMENTS_URL}/categories`,
    params: { type: this.type() },
  }));
  /**
   * Primero las ya usadas y después las sugeridas, sin repetir ni distinguir mayúsculas, filtradas por lo que se
   * va escribiendo: así el mismo gasto no queda en dos categorías escritas distinto.
   */
  protected readonly categories = computed(() => {
    const used = this.used.hasValue() ? this.used.value() : [];
    const typed = this.category().trim().toLowerCase();
    const seen = new Set<string>();
    return [...used, ...CATEGORY_SUGGESTIONS[this.type()]].filter((candidate) => {
      const key = candidate.trim().toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return key.includes(typed);
    });
  });

  /** Archivo elegido para subir como soporte al guardar. */
  protected readonly file = signal<File | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected chooseFile(event: Event): void {
    const chosen = (event.target as HTMLInputElement).files?.[0] ?? null;
    const problem = chosen ? attachmentProblem(chosen) : null;
    this.error.set(problem);
    this.file.set(problem ? null : chosen);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: MovementRequest = {
      ...value,
      category: value.category.trim(),
      description: value.description.trim(),
    };
    this.saving.set(true);
    this.error.set(null);
    const saved = this.movement
      ? this.api.update(this.movement.id, request)
      : this.api.create(request);
    saved.pipe(switchMap((movement) => this.upload(movement))).subscribe({
      next: (movement) => this.dialogRef.close(movement),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            400: 'Revisa los datos. El soporte debe ser PDF, JPG o PNG de hasta 5 MB.',
            403: 'Tu rol solo permite consultar.',
            413: 'El soporte no puede pesar más de 5 MB.',
          }),
        );
      },
    });
  }

  private upload(movement: Movement): Observable<Movement> {
    const file = this.file();
    return file ? this.api.attach(movement.id, file) : of(movement);
  }
}
