import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { filter, switchMap } from 'rxjs';
import { OrganizationRole } from '../../../core/auth/auth.models';
import { SessionStore } from '../../../core/auth/session-store';
import { ROLE_LABELS } from '../../../core/i18n/labels';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { AddMemberDialog, AddMemberDialogData } from '../add-member-dialog/add-member-dialog';
import { Member, ORGANIZATION_ROLES } from '../member.models';
import { MembersApi, membersUrl } from '../members-api';

const LAST_ADMIN = 'El prestador debe conservar al menos un administrador.';

/** Usuarios del prestador seleccionado: quién entra y con qué rol. */
@Component({
  selector: 'aq-member-list',
  imports: [
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressBarModule,
  ],
  templateUrl: './member-list.html',
  styleUrl: './member-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberList {
  private readonly api = inject(MembersApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Cambia sola si el usuario cambia de prestador desde la barra superior. */
  private readonly organizationId = computed(() => this.session.organization()?.organizationId);

  protected readonly members = httpResource<Member[]>(() => {
    const organizationId = this.organizationId();
    return organizationId ? membersUrl(organizationId) : undefined;
  });
  protected readonly busy = signal(false);

  protected readonly columns = ['name', 'role', 'since', 'actions'];
  protected readonly roles = ORGANIZATION_ROLES;

  // Las filas de mat-table no tienen tipo: estos métodos conservan el tipado estricto
  protected roleLabel(role: OrganizationRole): string {
    return ROLE_LABELS[role];
  }

  protected isCurrentUser(member: Member): boolean {
    return member.userId === this.session.user()?.id;
  }

  protected add(): void {
    const organization = this.session.organization();
    if (!organization) {
      return;
    }
    const data: AddMemberDialogData = {
      organizationId: organization.organizationId,
      organizationName: organization.name,
    };
    this.dialog
      .open<AddMemberDialog, AddMemberDialogData, Member>(AddMemberDialog, { data })
      .afterClosed()
      .pipe(filter((member) => member !== undefined))
      .subscribe((member) => {
        this.members.reload();
        this.notifier.success(`${member.fullName} ahora tiene acceso`);
      });
  }

  protected changeRole(member: Member, role: OrganizationRole): void {
    const organizationId = this.organizationId();
    if (!organizationId || role === member.role) {
      return;
    }
    this.busy.set(true);
    this.api.add(organizationId, { email: member.email, role }).subscribe({
      next: () => {
        this.busy.set(false);
        this.members.reload();
        this.notifier.success(`${member.fullName} ahora es ${ROLE_LABELS[role]}`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        // Vuelve a mostrar el rol real en el selector
        this.members.reload();
        this.notifier.apiError(error, { 422: LAST_ADMIN });
      },
    });
  }

  protected remove(member: Member): void {
    const organizationId = this.organizationId();
    if (!organizationId) {
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Quitar acceso',
      message: `${member.fullName} ya no podrá entrar a ${this.session.organization()?.name}. Su cuenta no se elimina.`,
      confirmLabel: 'Quitar acceso',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.api.remove(organizationId, member.userId)),
      )
      .subscribe({
        next: () => {
          this.members.reload();
          this.notifier.success(`Se quitó el acceso de ${member.fullName}`);
        },
        error: (error: unknown) => this.notifier.apiError(error, { 422: LAST_ADMIN }),
      });
  }
}
