import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { Notifier } from '../../../core/ui/notifier';
import { applyServerErrors } from '../../../shared/forms/server-errors';
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  DocumentType,
  formatCode,
  Subscriber,
} from '../subscriber.models';
import { SUBSCRIBERS_URL, SubscribersApi } from '../subscribers-api';

/** Los mismos límites que valida el backend, para avisar antes de enviar. */
const DOCUMENT_NUMBER = /^[A-Za-z0-9-]{3,20}$/;
const PHONE = /^\+?\d{7,15}$/;

/** Tipo y número de documento van juntos: o los dos o ninguno. */
function documentPair(group: AbstractControl): ValidationErrors | null {
  const { documentType, documentNumber } = group.value as {
    documentType: DocumentType | '';
    documentNumber: string;
  };
  return Boolean(documentType) === Boolean(documentNumber?.trim()) ? null : { documentPair: true };
}

/** Alta y edición de un suscriptor. Con `id` (ruta `/suscriptores/:id/editar`) edita. */
@Component({
  selector: 'aq-subscriber-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './subscriber-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriberForm {
  private readonly api = inject(SubscribersApi);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);

  /** Parámetro de ruta `:id`; ausente al crear. */
  readonly id = input<string>();

  protected readonly editing = computed(() => this.id() !== undefined);
  protected readonly existing = httpResource<Subscriber>(() => {
    const id = this.id();
    return id ? `${SUBSCRIBERS_URL}/${id}` : undefined;
  });

  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly documentTypeLabels = DOCUMENT_TYPE_LABELS;
  protected readonly formatCode = formatCode;

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      documentType: ['' as DocumentType | ''],
      documentNumber: ['', Validators.pattern(DOCUMENT_NUMBER)],
      email: ['', [Validators.email, Validators.maxLength(254)]],
      phone: ['', Validators.pattern(PHONE)],
    },
    { validators: documentPair },
  );
  protected readonly saving = signal(false);

  constructor() {
    // Al editar, carga los datos actuales en el formulario
    effect(() => {
      if (!this.existing.hasValue()) {
        return;
      }
      const subscriber = this.existing.value();
      untracked(() =>
        this.form.patchValue({
          fullName: subscriber.fullName,
          documentType: subscriber.documentType ?? '',
          documentNumber: subscriber.documentNumber ?? '',
          email: subscriber.email ?? '',
          phone: subscriber.phone ?? '',
        }),
      );
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request = {
      fullName: value.fullName.trim(),
      documentType: value.documentType || null,
      documentNumber: value.documentNumber.trim() || null,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
    };
    const id = this.id();
    this.saving.set(true);
    (id ? this.api.update(id, request) : this.api.register(request)).subscribe({
      next: (subscriber) => {
        this.notifier.success(
          id
            ? 'Cambios guardados'
            : `Suscriptor registrado con el código ${formatCode(subscriber.code)}`,
        );
        void this.router.navigate(['/suscriptores', subscriber.id]);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const problem = this.notifier.apiError(error, {
          403: 'Tu rol solo permite consultar.',
          409: 'Ya hay un suscriptor con ese documento en este prestador.',
        });
        if (problem.status === 409) {
          this.form.controls.documentNumber.setErrors({ duplicate: true });
        }
        applyServerErrors(this.form, problem);
      },
    });
  }
}
