import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { Notifier } from '../../../core/ui/notifier';
import { saveFile } from '../../../shared/ui/save-file';
import { ImportResult } from '../subscriber.models';

export const IMPORT_URL = '/api/v1/imports/subscribers';

/**
 * Carga inicial desde un CSV: primero se revisa el archivo y, si no tiene errores, se importa completo. Con un
 * solo error no se guarda ninguna fila.
 */
@Component({
  selector: 'aq-subscriber-import',
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './subscriber-import.html',
  styleUrl: './subscriber-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriberImport {
  private readonly http = inject(HttpClient);
  private readonly notifier = inject(Notifier);

  protected readonly file = signal<File | null>(null);
  /** Resultado de la última revisión del archivo elegido. */
  protected readonly review = signal<ImportResult | null>(null);
  /** Filas guardadas, cuando la importación terminó. */
  protected readonly imported = signal<number | null>(null);
  protected readonly busy = signal(false);

  protected chooseFile(event: Event): void {
    const chosen = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(chosen);
    this.review.set(null);
    this.imported.set(null);
    if (chosen) {
      this.send(chosen, true);
    }
  }

  protected importFile(): void {
    const file = this.file();
    if (file) {
      this.send(file, false);
    }
  }

  protected downloadTemplate(): void {
    this.http.get(`${IMPORT_URL}/template`, { responseType: 'blob' }).subscribe({
      next: (template) => saveFile(template, 'plantilla-suscriptores.csv'),
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }

  private send(file: File, validateOnly: boolean): void {
    const form = new FormData();
    form.append('file', file);
    this.busy.set(true);
    this.http.post<ImportResult>(IMPORT_URL, form, { params: { validateOnly } }).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.review.set(result);
        if (!validateOnly && result.errors.length === 0) {
          this.imported.set(result.imported);
          this.notifier.success(`${result.imported} suscriptores importados`);
        }
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.notifier.apiError(error, {
          400: 'No pudimos leer el archivo. Debe ser un CSV con las columnas «nombre» y «direccion», de máximo 2.000 filas.',
          403: 'Solo el administrador del prestador importa suscriptores.',
          413: 'El archivo no puede pesar más de 5 MB.',
        });
      },
    });
  }
}
