import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Notifier } from '../../../core/ui/notifier';
import { saveFile } from '../../../shared/ui/save-file';
import { ImportResult } from '../subscriber.models';

export const HISTORY_IMPORT_URL = '/api/v1/imports/consumption-history';

/**
 * Historial de consumos que trae un prestador de su sistema anterior (p. ej. los últimos 6 meses). No se factura:
 * completa el promedio de cada predio para detectar consumos inusuales y estimar desde la primera lectura. Como la
 * carga de suscriptores, se revisa primero y se importa todo o nada.
 */
@Component({
  selector: 'aq-history-import',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './history-import.html',
  styleUrl: '../subscriber-import/subscriber-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryImport {
  private readonly http = inject(HttpClient);
  private readonly notifier = inject(Notifier);

  protected readonly file = signal<File | null>(null);
  protected readonly review = signal<ImportResult | null>(null);
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
    this.http.get(`${HISTORY_IMPORT_URL}/template`, { responseType: 'blob' }).subscribe({
      next: (template) => saveFile(template, 'plantilla-historial-consumos.csv'),
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }

  private send(file: File, validateOnly: boolean): void {
    const form = new FormData();
    form.append('file', file);
    this.busy.set(true);
    this.http.post<ImportResult>(HISTORY_IMPORT_URL, form, { params: { validateOnly } }).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.review.set(result);
        if (!validateOnly && result.errors.length === 0) {
          this.imported.set(result.imported);
          this.notifier.success(`${result.imported} consumos importados`);
        }
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.notifier.apiError(error, {
          400: 'No pudimos leer el archivo. Debe ser un CSV con «periodo», «consumo» y «medidor» o «predio», de máximo 30.000 filas.',
          403: 'Solo el administrador del prestador importa el historial.',
          413: 'El archivo no puede pesar más de 5 MB.',
        });
      },
    });
  }
}
