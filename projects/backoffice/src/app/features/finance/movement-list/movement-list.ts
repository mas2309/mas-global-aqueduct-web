import { CurrencyPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, switchMap } from 'rxjs';
import { SessionStore } from '../../../core/auth/session-store';
import { Notifier } from '../../../core/ui/notifier';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/ui/confirm-dialog';
import { saveFile } from '../../../shared/ui/save-file';
import { Page } from '../../organizations/organization.models';
import { isoDate } from '../../reports/report.models';
import { FinanceApi } from '../finance-api';
import {
  Balance,
  Movement,
  MOVEMENT_TYPE_LABELS,
  MovementType,
  MOVEMENTS_URL,
} from '../finance.models';
import { MovementDialog } from '../movement-dialog/movement-dialog';

type TypeFilter = MovementType | 'ALL';

/**
 * Ingresos y gastos del prestador con sus soportes, y el saldo del rango: recaudo de facturas más otros ingresos
 * menos gastos.
 */
@Component({
  selector: 'aq-movement-list',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './movement-list.html',
  styleUrl: './movement-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementList {
  private readonly api = inject(FinanceApi);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Por defecto, el mes en curso. */
  protected readonly from = signal(isoDate(firstOfMonth()));
  protected readonly to = signal(isoDate(new Date()));
  protected readonly type = signal<TypeFilter>('ALL');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly validRange = computed(
    () => this.from() !== '' && this.to() !== '' && this.from() <= this.to(),
  );
  private readonly ready = computed(
    () => !!this.session.organization()?.organizationId && this.validRange(),
  );

  /** Se vuelven a consultar solas al cambiar las fechas, el tipo, la página o el prestador. */
  protected readonly movements = httpResource<Page<Movement>>(() => {
    if (!this.ready()) {
      return undefined;
    }
    const params: Record<string, string | number> = {
      from: this.from(),
      to: this.to(),
      page: this.pageIndex(),
      size: this.pageSize(),
    };
    const type = this.type();
    if (type !== 'ALL') {
      params['type'] = type;
    }
    return { url: MOVEMENTS_URL, params };
  });
  protected readonly balance = httpResource<Balance>(() =>
    this.ready()
      ? { url: `${MOVEMENTS_URL}/balance`, params: { from: this.from(), to: this.to() } }
      : undefined,
  );

  protected readonly columns = ['date', 'type', 'category', 'description', 'amount', 'actions'];

  // Las filas de mat-table no tienen tipo: este método conserva el tipado estricto
  protected typeOf(movement: Movement): string {
    return MOVEMENT_TYPE_LABELS[movement.type];
  }

  protected changeRange(from: string, to: string): void {
    this.pageIndex.set(0);
    this.from.set(from);
    this.to.set(to);
  }

  protected filterBy(type: TypeFilter): void {
    this.pageIndex.set(0);
    this.type.set(type);
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  /** Registra un movimiento nuevo o corrige el indicado. */
  protected edit(movement: Movement | null): void {
    this.dialog
      .open<MovementDialog, Movement | null, Movement>(MovementDialog, {
        data: movement,
        width: '520px',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload();
          this.notifier.success(movement ? 'Movimiento actualizado' : 'Movimiento registrado');
        }
      });
  }

  protected remove(movement: Movement): void {
    const data: ConfirmDialogData = {
      title: `Eliminar ${MOVEMENT_TYPE_LABELS[movement.type].toLowerCase()}`,
      message: `Se elimina «${movement.description}»${movement.attachment ? ' junto con su soporte' : ''}. No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialog, { data, width: '440px' })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.api.delete(movement.id)),
      )
      .subscribe({
        next: () => {
          this.reload();
          this.notifier.success('Movimiento eliminado');
        },
        error: (error: unknown) =>
          this.notifier.apiError(error, { 403: 'Tu rol solo permite consultar.' }),
      });
  }

  protected downloadAttachment(movement: Movement): void {
    this.api.attachment(movement.id).subscribe({
      next: (file) => saveFile(file, movement.attachment?.fileName ?? 'soporte'),
      error: (error: unknown) =>
        this.notifier.apiError(error, { 404: 'No encontramos el archivo del soporte.' }),
    });
  }

  protected export(): void {
    this.api.export(this.from(), this.to()).subscribe({
      next: (file) => saveFile(file, `ingresos-y-gastos-${this.from()}-a-${this.to()}.csv`),
      error: (error: unknown) => this.notifier.apiError(error),
    });
  }

  private reload(): void {
    this.movements.reload();
    this.balance.reload();
  }
}

function firstOfMonth(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
}
