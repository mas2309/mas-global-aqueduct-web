import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Page } from '../../organizations/organization.models';
import { formatCode, Subscriber } from '../../subscribers/subscriber.models';
import { SUBSCRIBERS_URL } from '../../subscribers/subscribers-api';
import { GlobalCharge } from '../invoice.models';
import { InvoicesApi } from '../invoices-api';

/**
 * Aplica un cobro global a un suscriptor que no lo tiene, por ejemplo uno que se registró después de crearlo.
 * Devuelve `true` si se agregó.
 */
@Component({
  selector: 'aq-charge-subscriber-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Agregar suscriptor a «{{ charge.description }}»</h2>
    <mat-dialog-content>
      <form class="search" role="search" (ngSubmit)="query.set(searchText().trim())">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Buscar por nombre, documento o código</mat-label>
          <input
            matInput
            name="q"
            type="search"
            [ngModel]="searchText()"
            (ngModelChange)="searchText.set($event)"
            maxlength="100"
          />
        </mat-form-field>
        <button mat-stroked-button type="submit">
          <mat-icon>search</mat-icon>
          Buscar
        </button>
      </form>

      @if (results.error()) {
        <p class="error" role="alert">No pudimos buscar los suscriptores.</p>
      } @else if (results.hasValue()) {
        <ul class="results">
          @for (subscriber of results.value().items; track subscriber.id) {
            <li>
              <span>{{ formatCode(subscriber.code) }} · {{ subscriber.fullName }}</span>
              <button
                mat-button
                [disabled]="saving() || subscriber.status !== 'ACTIVE'"
                (click)="add(subscriber)"
              >
                {{ subscriber.status === 'ACTIVE' ? 'Agregar' : 'Inactivo' }}
              </button>
            </li>
          } @empty {
            <li class="muted">Ningún suscriptor coincide.</li>
          }
        </ul>
      }
      <div aria-live="assertive">
        @if (error(); as message) {
          <p class="error">{{ message }}</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .search {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;

      mat-form-field {
        flex: 1;
      }
    }

    .results {
      margin: 12px 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
  `,
})
export class ChargeSubscriberDialog {
  private readonly api = inject(InvoicesApi);
  private readonly dialogRef = inject<MatDialogRef<ChargeSubscriberDialog, boolean>>(MatDialogRef);
  protected readonly charge = inject<GlobalCharge>(MAT_DIALOG_DATA);

  protected readonly searchText = signal('');
  /** Texto ya enviado; no se busca hasta que el usuario lo pide. */
  protected readonly query = signal('');
  protected readonly results = httpResource<Page<Subscriber>>(() =>
    this.query() ? { url: SUBSCRIBERS_URL, params: { q: this.query(), size: 5 } } : undefined,
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formatCode = formatCode;

  protected add(subscriber: Subscriber): void {
    this.saving.set(true);
    this.error.set(null);
    this.api.addChargeSubscriber(this.charge.id, subscriber.id).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          problemMessage(toProblem(error), {
            403: 'Solo el administrador del prestador gestiona los cobros globales.',
            409: `${subscriber.fullName} ya tiene este cobro, o el cobro está cancelado.`,
            422: 'El suscriptor no está activo.',
          }),
        );
      },
    });
  }
}
