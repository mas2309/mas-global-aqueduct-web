import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { ROLE_LABELS } from '../../../core/i18n/labels';
import { Member, ORGANIZATION_ROLES, ROLE_DESCRIPTIONS } from '../member.models';
import { MembersApi } from '../members-api';

export interface EditMemberDialogData {
  organizationId: string;
  member: Member;
}

/**
 * Cambia el nombre y el rol de un usuario del prestador. El nombre solo se edita si la cuenta es exclusiva de este
 * prestador; si trabaja también en otros, lo cambia el administrador de plataforma. Devuelve el miembro actualizado.
 */
@Component({
  selector: 'aq-edit-member-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Editar usuario</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="muted">{{ data.member.email }}</p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nombre completo</mat-label>
          <input matInput formControlName="fullName" cdkFocusInitial />
          @if (!editable) {
            <mat-hint
              >Trabaja también en otros prestadores: su nombre lo cambia la plataforma</mat-hint
            >
          }
          @if (form.controls.fullName.invalid) {
            <mat-error>Entre 2 y 150 caracteres</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Rol</mat-label>
          <mat-select formControlName="role">
            @for (role of roles; track role) {
              <mat-option [value]="role">
                {{ roleLabels[role] }} — {{ roleDescriptions[role] }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      margin-top: 8px;
    }
  `,
})
export class EditMemberDialog {
  private readonly api = inject(MembersApi);
  private readonly dialogRef = inject<MatDialogRef<EditMemberDialog, Member>>(MatDialogRef);
  protected readonly data = inject<EditMemberDialogData>(MAT_DIALOG_DATA);

  protected readonly roles = ORGANIZATION_ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly roleDescriptions = ROLE_DESCRIPTIONS;
  protected readonly editable = this.data.member.accountEditable === true;

  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: [
      { value: this.data.member.fullName, disabled: !this.editable },
      [Validators.required, Validators.minLength(2), Validators.maxLength(150)],
    ],
    role: [this.data.member.role, Validators.required],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { fullName, role } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .update(this.data.organizationId, this.data.member.userId, {
        fullName: this.editable ? fullName.trim() : null,
        role,
      })
      .subscribe({
        next: (member) => this.dialogRef.close(member),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            problemMessage(toProblem(error), {
              403: 'Solo el administrador del prestador edita sus usuarios.',
              422: 'No se pudo guardar: el prestador debe conservar al menos un administrador.',
            }),
          );
        },
      });
  }
}
