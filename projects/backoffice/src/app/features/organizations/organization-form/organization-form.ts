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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ORGANIZATION_TYPE_LABELS, SERVICE_ICONS, SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { applyServerErrors } from '../../../shared/forms/server-errors';
import { nitValidator } from '../../../shared/validators/nit';
import {
  Organization,
  ORGANIZATION_TYPES,
  OrganizationType,
  SERVICE_TYPES,
  ServiceType,
} from '../organization.models';
import { ORGANIZATIONS_URL, OrganizationsApi } from '../organizations-api';

/** Los mismos límites que valida el backend, para avisar antes de enviar. */
const DANE_MUNICIPALITY = /^\d{5}$/;
const PHONE = /^\+?\d{7,15}$/;

/**
 * Alta y edición de un prestador. Con `id` (ruta `/prestadores/:id/editar`) edita: el NIT queda bloqueado y
 * los servicios se gestionan desde el detalle.
 */
@Component({
  selector: 'aq-organization-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './organization-form.html',
  styleUrl: './organization-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationForm {
  private readonly api = inject(OrganizationsApi);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);

  /** Parámetro de ruta `:id`; ausente al crear. */
  readonly id = input<string>();

  protected readonly editing = computed(() => this.id() !== undefined);
  protected readonly existing = httpResource<Organization>(() => {
    const id = this.id();
    return id ? `${ORGANIZATIONS_URL}/${id}` : undefined;
  });

  protected readonly types = ORGANIZATION_TYPES;
  protected readonly serviceTypes = SERVICE_TYPES;
  protected readonly typeLabels = ORGANIZATION_TYPE_LABELS;
  protected readonly serviceLabels = SERVICE_LABELS;
  protected readonly serviceIcons = SERVICE_ICONS;

  protected readonly form = inject(NonNullableFormBuilder).group({
    nit: ['', [Validators.required, nitValidator]],
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    tradeName: ['', Validators.maxLength(200)],
    type: ['COMMUNITY_AQUEDUCT' as OrganizationType, Validators.required],
    municipalityCode: ['', [Validators.required, Validators.pattern(DANE_MUNICIPALITY)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', Validators.pattern(PHONE)],
  });
  /** Al crear: al menos un servicio, como exige el backend. Acueducto marcado por defecto. */
  protected readonly services = signal<ReadonlySet<ServiceType>>(new Set<ServiceType>(['WATER']));
  protected readonly saving = signal(false);

  constructor() {
    // Al editar, carga los datos actuales en el formulario
    effect(() => {
      if (!this.existing.hasValue()) {
        return;
      }
      const organization = this.existing.value();
      untracked(() => {
        this.form.patchValue({
          nit: organization.nit,
          legalName: organization.legalName,
          tradeName: organization.tradeName ?? '',
          type: organization.type,
          municipalityCode: organization.municipalityCode,
          email: organization.email ?? '',
          phone: organization.phone ?? '',
        });
        this.form.controls.nit.disable();
      });
    });
  }

  protected toggleService(service: ServiceType, checked: boolean): void {
    this.services.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(service);
      } else {
        next.delete(service);
      }
      return next;
    });
  }

  protected submit(): void {
    const id = this.id();
    if (this.form.invalid || (!id && this.services().size === 0)) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const details = {
      legalName: value.legalName.trim(),
      tradeName: value.tradeName.trim() || null,
      type: value.type,
      municipalityCode: value.municipalityCode,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
    };
    if (id) {
      this.save(this.api.update(id, details), 'Cambios guardados', {
        422: 'No se puede cambiar el tipo mientras el prestador tenga vinculaciones activas. Termínalas primero.',
      });
    } else {
      this.save(
        this.api.register({ ...details, nit: value.nit.trim(), services: [...this.services()] }),
        'Prestador vinculado a la plataforma',
        { 409: 'Ya existe un prestador con ese NIT.' },
      );
    }
  }

  private save(
    request: Observable<Organization>,
    successMessage: string,
    errorMessages: Partial<Record<number, string>>,
  ): void {
    this.saving.set(true);
    request.subscribe({
      next: (organization) => {
        this.notifier.success(successMessage);
        void this.router.navigate(['/prestadores', organization.id]);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const problem = this.notifier.apiError(error, errorMessages);
        if (problem.status === 409) {
          this.form.controls.nit.setErrors({ duplicate: true });
        }
        applyServerErrors(this.form, problem);
      },
    });
  }
}
