import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../core/auth/session-store';
import { Notifier } from '../../../core/ui/notifier';
import { saveFile } from '../../../shared/ui/save-file';
import { formatCode } from '../../subscribers/subscriber.models';
import { ClaimAnswerDialog } from '../claim-answer-dialog/claim-answer-dialog';
import { ClaimNotifyDialog } from '../claim-notify-dialog/claim-notify-dialog';
import {
  Claim,
  CLAIM_CHANNEL_LABELS,
  CLAIM_DECISION_LABELS,
  CLAIM_STATE_LABELS,
  CLAIM_TYPE_LABELS,
  CLAIMS_URL,
  ClaimAttachment,
  deadlineLabel,
  isPending,
} from '../claim.models';

/** Una PQR: su plazo, respuesta, notificación y soportes. */
@Component({
  selector: 'aq-claim-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './claim-detail.html',
  styles: `
    mat-card {
      margin-bottom: 16px;
    }
    .data {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 6px 16px;
      margin: 0;

      dt {
        color: var(--mat-sys-on-surface-variant);
      }
      dd {
        margin: 0;
      }
    }
    .attachments {
      margin: 8px 0;
      padding: 0;
      list-style: none;
    }
    .late {
      color: var(--mat-sys-error);
      font-weight: 500;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClaimDetail {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  protected readonly session = inject(SessionStore);

  /** Parámetro de ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly claim = httpResource<Claim>(() => `${CLAIMS_URL}/${this.id()}`);
  protected readonly uploading = signal(false);

  protected readonly stateLabels = CLAIM_STATE_LABELS;
  protected readonly typeLabels = CLAIM_TYPE_LABELS;
  protected readonly channelLabels = CLAIM_CHANNEL_LABELS;
  protected readonly decisionLabels = CLAIM_DECISION_LABELS;
  protected readonly formatCode = formatCode;
  protected readonly deadlineLabel = deadlineLabel;
  protected readonly isPending = isPending;

  protected answer(claim: Claim): void {
    this.dialog
      .open<ClaimAnswerDialog, Claim, Claim>(ClaimAnswerDialog, { data: claim, width: '560px' })
      .afterClosed()
      .subscribe((answered) => {
        if (answered) {
          this.claim.set(answered);
          this.notifier.success('Respuesta registrada: falta notificarla');
        }
      });
  }

  protected notify(claim: Claim): void {
    this.dialog
      .open<ClaimNotifyDialog, Claim, Claim>(ClaimNotifyDialog, { data: claim, width: '440px' })
      .afterClosed()
      .subscribe((notified) => {
        if (notified) {
          this.claim.set(notified);
          this.notifier.success('Notificación registrada');
        }
      });
  }

  protected attach(claim: Claim, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const form = new FormData();
    form.append('file', file);
    this.uploading.set(true);
    this.http.post<Claim>(`${CLAIMS_URL}/${claim.id}/attachments`, form).subscribe({
      next: (updated) => {
        this.uploading.set(false);
        this.claim.set(updated);
        this.notifier.success('Soporte adjuntado');
      },
      error: (error: unknown) => {
        this.uploading.set(false);
        this.notifier.apiError(error, {
          403: 'Tu rol solo permite consultar.',
          422: 'El soporte debe ser un PDF, PNG o JPG de hasta 5 MB.',
        });
      },
    });
  }

  protected download(claim: Claim, attachment: ClaimAttachment): void {
    this.http
      .get(`${CLAIMS_URL}/${claim.id}/attachments/${attachment.id}`, { responseType: 'blob' })
      .subscribe({
        next: (content) => saveFile(content, attachment.fileName),
        error: (error: unknown) => this.notifier.apiError(error),
      });
  }
}
