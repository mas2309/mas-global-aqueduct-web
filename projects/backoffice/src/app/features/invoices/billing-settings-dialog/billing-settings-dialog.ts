import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { problemMessage, toProblem } from '../../../core/api/problem';
import { Observable } from 'rxjs';
import { MAX_ATTACHMENT_BYTES } from '../../finance/finance.models';
import { BillingSettings } from '../invoice.models';
import { BILLING_SETTINGS_URL, InvoicesApi } from '../invoices-api';

/**
 * Reglas de facturación del prestador: hasta qué día se paga sin que la factura quede vencida y cuánto se
 * recarga cuando la anterior no se pagó. Devuelve la configuración guardada.
 */
@Component({
  selector: 'aq-billing-settings-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Configuración de las facturas</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="muted">
          Aplica a las facturas que se generen desde ahora; las ya emitidas no cambian.
        </p>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Día límite de pago</mat-label>
          <input matInput type="number" min="1" max="31" formControlName="paymentDueDay" />
          <mat-hint>Del mes siguiente al periodo facturado</mat-hint>
          @if (form.controls.paymentDueDay.invalid) {
            <mat-error>Debe ser un día entre 1 y 31</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Recargo por no pago</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" min="0" formControlName="lateFee" inputmode="numeric" />
          <mat-hint>Se cobra cuando la factura anterior no se pagó. Cero para no cobrarlo</mat-hint>
          @if (form.controls.lateFee.invalid) {
            <mat-error>Debe ser cero o más</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Línea de cabecera</mat-label>
          <input matInput formControlName="invoiceHeader" maxlength="200" autocomplete="off" />
          <mat-hint
            >Sale bajo el nombre: dirección de la oficina, cuenta para consignar. Opcional</mat-hint
          >
        </mat-form-field>
        <div class="logo">
          <input
            #logoPicker
            type="file"
            accept="image/png,image/jpeg"
            class="cdk-visually-hidden"
            aria-label="Imagen del logo"
            (change)="chooseLogo($event)"
          />
          <span>{{
            hasLogo() ? 'Las facturas salen con tu logo.' : 'Las facturas salen sin logo.'
          }}</span>
          <button
            mat-stroked-button
            type="button"
            [disabled]="saving()"
            (click)="logoPicker.click()"
          >
            {{ hasLogo() ? 'Cambiar logo' : 'Subir logo' }}
          </button>
          @if (hasLogo()) {
            <button mat-button type="button" [disabled]="saving()" (click)="removeLogo()">
              Quitar logo
            </button>
          }
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nota en las facturas</mat-label>
          <textarea matInput formControlName="invoiceNote" maxlength="300" rows="3"></textarea>
          <mat-hint>Aviso al pie de todas las facturas: cortes, reuniones. Opcional</mat-hint>
        </mat-form-field>
        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="error">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving() || !current.hasValue()">
          Guardar
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      margin-top: 12px;
    }

    .logo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin: 16px 0 4px;

      span {
        flex: 1;
        min-width: 180px;
      }
    }
  `,
})
export class BillingSettingsDialog {
  private readonly api = inject(InvoicesApi);
  private readonly dialogRef =
    inject<MatDialogRef<BillingSettingsDialog, BillingSettings>>(MatDialogRef);

  protected readonly current = httpResource<BillingSettings>(() => BILLING_SETTINGS_URL);
  protected readonly form = inject(NonNullableFormBuilder).group({
    paymentDueDay: [20, [Validators.required, Validators.min(1), Validators.max(31)]],
    lateFee: [0, [Validators.required, Validators.min(0)]],
    invoiceHeader: ['', Validators.maxLength(200)],
    invoiceNote: ['', Validators.maxLength(300)],
  });
  /** El logo se sube y se quita aparte, de inmediato: no espera a «Guardar». */
  protected readonly hasLogo = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.current.hasValue()) {
        const { paymentDueDay, lateFee, invoiceNote, invoiceHeader, hasLogo } =
          this.current.value();
        this.form.setValue({
          paymentDueDay,
          lateFee,
          invoiceHeader: invoiceHeader ?? '',
          invoiceNote: invoiceNote ?? '',
        });
        this.hasLogo.set(hasLogo ?? false);
      }
    });
  }

  protected chooseLogo(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > MAX_ATTACHMENT_BYTES) {
      this.error.set('El logo debe ser una imagen PNG o JPG de hasta 5 MB.');
      return;
    }
    this.changeLogo(this.api.uploadLogo(file));
  }

  protected removeLogo(): void {
    this.changeLogo(this.api.removeLogo());
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const { invoiceNote, invoiceHeader, ...rules } = this.form.getRawValue();
    this.api
      .updateSettings({
        ...rules,
        invoiceNote: invoiceNote.trim() || null,
        invoiceHeader: invoiceHeader.trim() || null,
      })
      .subscribe({
        next: (settings) => this.dialogRef.close(settings),
        error: (error: unknown) => this.fail(error),
      });
  }

  private changeLogo(change: Observable<BillingSettings>): void {
    this.saving.set(true);
    this.error.set(null);
    change.subscribe({
      next: (settings) => {
        this.saving.set(false);
        this.hasLogo.set(settings.hasLogo ?? false);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.saving.set(false);
    this.error.set(
      problemMessage(toProblem(error), {
        400: 'El logo debe ser una imagen PNG o JPG de hasta 5 MB.',
        403: 'Solo el administrador del prestador cambia esta configuración.',
      }),
    );
  }
}
