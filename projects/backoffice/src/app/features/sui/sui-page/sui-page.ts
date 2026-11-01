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
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { SessionStore } from '../../../core/auth/session-store';
import { SERVICE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { saveFile } from '../../../shared/ui/save-file';
import { SERVICE_TYPES, ServiceType } from '../../organizations/organization.models';
import {
  SUI_CODE_KEY_PATTERN,
  SUI_CODE_VALUE_PATTERN,
  SUI_FIELD_LABELS,
  SUI_FIELDS,
  SUI_FORMAT_LABELS,
  SUI_FORMATS,
  SUI_HEADER_PATTERN,
  SUI_URL,
  SuiColumn,
  SuiField,
  SuiFormat,
  SuiReview,
  SuiTemplate,
} from '../sui.models';

interface CodeRow {
  key: string;
  value: string;
}

/**
 * Archivos CSV para el SUI: revisar lo que hay por corregir, exportar y ajustar la plantilla. La plataforma no genera
 * el `.sui` ni carga nada: el prestador los pasa por el validador oficial y los carga con su usuario.
 */
@Component({
  selector: 'aq-sui-page',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './sui-page.html',
  styles: `
    mat-card {
      margin: 16px 0;
    }
    .notice {
      padding: 12px;
      border-radius: 8px;
      background: var(--mat-sys-tertiary-container);
    }
    .issues,
    .rows {
      width: 100%;
      border-collapse: collapse;

      th,
      td {
        padding: 6px 8px;
        text-align: left;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
    .rows mat-form-field {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuiPage {
  private readonly http = inject(HttpClient);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  protected readonly format = signal<SuiFormat>('USER_CATALOG');
  protected readonly template = httpResource<SuiTemplate>(
    () => `${SUI_URL}/${this.format()}/template`,
  );
  /** Revisar y exportar son para quien opera: un rol de consulta solo ve la plantilla. */
  protected readonly review = httpResource<SuiReview>(() =>
    this.session.canOperateOrganization() ? `${SUI_URL}/${this.format()}/review` : undefined,
  );
  protected readonly canExport = computed(
    () => this.review.hasValue() && this.review.value().issues.length === 0,
  );

  // Plantilla en edición
  protected readonly columns = signal<SuiColumn[]>([]);
  protected readonly codes = signal<CodeRow[]>([]);
  protected readonly saving = signal(false);
  protected readonly valid = computed(
    () =>
      this.columns().length > 0 &&
      this.columns().every((column) => SUI_HEADER_PATTERN.test(column.header)) &&
      new Set(this.columns().map((column) => column.header)).size === this.columns().length &&
      this.codes().every(
        (code) => SUI_CODE_KEY_PATTERN.test(code.key) && SUI_CODE_VALUE_PATTERN.test(code.value),
      ),
  );

  protected readonly formats = SUI_FORMATS;
  protected readonly formatLabels = SUI_FORMAT_LABELS;
  protected readonly fields = SUI_FIELDS;
  protected readonly fieldLabels = SUI_FIELD_LABELS;
  protected readonly services = SERVICE_TYPES;
  protected readonly serviceLabels = SERVICE_LABELS;

  constructor() {
    effect(() => {
      if (this.template.hasValue()) {
        const template = this.template.value();
        untracked(() => this.fill(template));
      }
    });
  }

  protected export(): void {
    const format = this.format();
    this.http.get(`${SUI_URL}/${format}/export`, { responseType: 'blob' }).subscribe({
      next: (content) => saveFile(content, `${format.toLowerCase()}.csv`),
      error: (error: unknown) =>
        this.notifier.apiError(error, {
          403: 'Tu rol solo permite consultar.',
          422: 'Hay datos por corregir antes de exportar.',
        }),
    });
  }

  protected updateColumn(index: number, change: Partial<SuiColumn>): void {
    this.columns.update((columns) =>
      columns.map((column, position) => (position === index ? { ...column, ...change } : column)),
    );
  }

  protected setField(index: number, field: SuiField): void {
    this.updateColumn(index, { field });
  }

  protected setService(index: number, service: ServiceType | null): void {
    this.updateColumn(index, { service });
  }

  protected addColumn(): void {
    this.columns.update((columns) => [
      ...columns,
      { header: `COLUMNA ${columns.length + 1}`, field: 'PROPERTY_CODE', service: null },
    ]);
  }

  protected removeColumn(index: number): void {
    this.columns.update((columns) => columns.filter((_, position) => position !== index));
  }

  /** El orden de las filas es el del archivo. */
  protected moveUp(index: number): void {
    if (index === 0) {
      return;
    }
    this.columns.update((columns) => {
      const moved = [...columns];
      [moved[index - 1], moved[index]] = [moved[index], moved[index - 1]];
      return moved;
    });
  }

  protected updateCode(index: number, change: Partial<CodeRow>): void {
    this.codes.update((codes) =>
      codes.map((code, position) => (position === index ? { ...code, ...change } : code)),
    );
  }

  protected addCode(): void {
    this.codes.update((codes) => [...codes, { key: '', value: '' }]);
  }

  protected removeCode(index: number): void {
    this.codes.update((codes) => codes.filter((_, position) => position !== index));
  }

  protected save(): void {
    if (!this.valid() || this.saving()) {
      return;
    }
    const codes = Object.fromEntries(this.codes().map((code) => [code.key, code.value]));
    this.saving.set(true);
    this.http
      .put<SuiTemplate>(`${SUI_URL}/${this.format()}/template`, { columns: this.columns(), codes })
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.template.set(saved);
          this.review.reload();
          this.notifier.success(`Plantilla guardada: versión ${saved.version}`);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.notifier.apiError(error, {
            400: 'Revisa la plantilla: encabezados sin signos y sin repetir, y códigos solo con letras y números.',
            403: 'Solo el administrador del prestador cambia la plantilla.',
          });
        },
      });
  }

  private fill(template: SuiTemplate): void {
    this.columns.set(template.columns.map((column) => ({ ...column, service: column.service ?? null })));
    this.codes.set(
      Object.entries(template.codes)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, value]) => ({ key, value })),
    );
  }
}
