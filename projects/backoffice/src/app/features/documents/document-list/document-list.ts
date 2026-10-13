import { DatePipe } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { filter, switchMap } from 'rxjs';
import { SessionStore } from '../../../core/auth/session-store';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { saveFile } from '../../../shared/ui/save-file';
import { DocumentDialog } from '../document-dialog/document-dialog';
import { DOCUMENTS_URL, StoredDocument } from '../document.models';

/**
 * Documentos importantes del prestador (estatutos, actas, la concesión de aguas): se suben una vez y quedan a la
 * mano de todo el equipo.
 */
@Component({
  selector: 'aq-document-list',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './document-list.html',
  styleUrl: './document-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentList {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Se vuelve a consultar sola al cambiar el prestador de la sesión. */
  protected readonly documents = httpResource<StoredDocument[]>(() =>
    this.session.organization()?.organizationId ? DOCUMENTS_URL : undefined,
  );

  protected upload(): void {
    this.dialog
      .open<DocumentDialog, void, StoredDocument>(DocumentDialog, { width: '480px' })
      .afterClosed()
      .subscribe((uploaded) => {
        if (uploaded) {
          this.documents.reload();
          this.notifier.success('Documento guardado');
        }
      });
  }

  protected download(document: StoredDocument): void {
    this.http.get(`${DOCUMENTS_URL}/${document.id}/file`, { responseType: 'blob' }).subscribe({
      next: (file) => saveFile(file, document.fileName),
      error: (error: unknown) =>
        this.notifier.apiError(error, { 404: 'No encontramos el archivo de este documento.' }),
    });
  }

  protected remove(document: StoredDocument): void {
    const data: ConfirmDialogData = {
      title: `Eliminar «${document.title}»`,
      message: 'Se elimina el documento y su archivo. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.http.delete<void>(`${DOCUMENTS_URL}/${document.id}`)),
      )
      .subscribe({
        next: () => {
          this.documents.reload();
          this.notifier.success('Documento eliminado');
        },
        error: (error: unknown) =>
          this.notifier.apiError(error, { 403: 'Tu rol solo permite consultar.' }),
      });
  }

  /** Tamaño legible: «320 kB», «1,4 MB». */
  protected sizeOf(document: StoredDocument): string {
    const kilobytes = document.size / 1024;
    return kilobytes < 1024
      ? `${Math.max(1, Math.round(kilobytes))} kB`
      : `${(kilobytes / 1024).toFixed(1).replace('.', ',')} MB`;
  }
}
