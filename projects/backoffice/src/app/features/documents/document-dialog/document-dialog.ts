import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { attachmentProblem } from '../../finance/finance.models';
import { DOCUMENTS_URL, StoredDocument } from '../document.models';

/** Sube un documento del prestador con su título. Devuelve el documento guardado. */
@Component({
  selector: 'aq-document-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Subir documento</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Título</mat-label>
          <input matInput formControlName="title" maxlength="150" autocomplete="off" />
          <mat-hint>Por ejemplo: Estatutos, Concesión de aguas</mat-hint>
          @if (form.controls.title.invalid) {
            <mat-error>Indica el título</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descripción</mat-label>
          <input matInput formControlName="description" maxlength="300" autocomplete="off" />
          <mat-hint>Opcional</mat-hint>
        </mat-form-field>
        <div class="file">
          <input
            #picker
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            class="cdk-visually-hidden"
            aria-label="Archivo del documento"
            (change)="chooseFile($event)"
          />
          <button mat-stroked-button type="button" (click)="picker.click()">
            <mat-icon>attach_file</mat-icon>
            Elegir archivo
          </button>
          <span class="muted">{{ file()?.name ?? 'PDF, JPG o PNG de hasta 5 MB' }}</span>
        </div>
        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Subir</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      margin-top: 12px;
    }

    .file {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin: 16px 0 12px;

      span {
        overflow-wrap: anywhere;
      }
    }
  `,
})
export class DocumentDialog {
  private readonly http = inject(HttpClient);
  private readonly dialogRef = inject<MatDialogRef<DocumentDialog, StoredDocument>>(MatDialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(150)]],
    description: ['', Validators.maxLength(300)],
  });
  protected readonly file = signal<File | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected chooseFile(event: Event): void {
    const chosen = (event.target as HTMLInputElement).files?.[0] ?? null;
    const problem = chosen ? attachmentProblem(chosen) : null;
    this.error.set(problem?.replace('El soporte', 'El documento') ?? null);
    this.file.set(problem ? null : chosen);
  }

  protected submit(): void {
    const file = this.file();
    if (this.form.invalid || !file) {
      this.form.markAllAsTouched();
      if (!file && !this.error()) {
        this.error.set('Elige el archivo del documento.');
      }
      return;
    }
    const { title, description } = this.form.getRawValue();
    const body = new FormData();
    body.append('file', file);
    body.append('title', title.trim());
    if (description.trim()) {
      body.append('description', description.trim());
    }
    this.saving.set(true);
    this.error.set(null);
    this.http.post<StoredDocument>(DOCUMENTS_URL, body).subscribe({
      next: (document) => this.dialogRef.close(document),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            400: 'El documento debe ser un PDF o una imagen JPG o PNG de hasta 5 MB.',
            403: 'Tu rol solo permite consultar.',
            413: 'El documento no puede pesar más de 5 MB.',
          }),
        );
      },
    });
  }
}
