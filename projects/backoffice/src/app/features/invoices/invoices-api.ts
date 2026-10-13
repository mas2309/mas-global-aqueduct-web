import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BillingSettings,
  GlobalCharge,
  GlobalChargeRequest,
  InstallmentPlan,
  InstallmentPlanRequest,
  Invoice,
  PaymentMethod,
} from './invoice.models';

export const INVOICES_URL = '/api/v1/invoices';
export const PLANS_URL = '/api/v1/installment-plans';
export const GLOBAL_CHARGES_URL = '/api/v1/global-charges';
export const BILLING_SETTINGS_URL = '/api/v1/billing-settings';

@Injectable({ providedIn: 'root' })
export class InvoicesApi {
  private readonly http = inject(HttpClient);

  /** Recaudo en la oficina. Pagar la factura más reciente salda también las anteriores incluidas en ella. */
  pay(invoiceId: string, method: PaymentMethod): Observable<Invoice> {
    return this.http.post<Invoice>(`${INVOICES_URL}/${invoiceId}/pay`, { method });
  }

  /** Deshace un pago registrado por error. Solo el administrador, con motivo, y solo en la factura más reciente. */
  reversePayment(invoiceId: string, reason: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${INVOICES_URL}/${invoiceId}/reverse-payment`, { reason });
  }

  /** Anula una factura de un servicio sin medidor emitida por error. Solo el administrador. */
  voidInvoice(invoiceId: string): Observable<void> {
    return this.http.delete<void>(`${INVOICES_URL}/${invoiceId}`);
  }

  /** Con valor cero se quitan los otros cobros. */
  changeOtherCharges(
    invoiceId: string,
    amount: number,
    description: string | null,
  ): Observable<Invoice> {
    return this.http.put<Invoice>(`${INVOICES_URL}/${invoiceId}/other-charges`, {
      amount,
      description,
    });
  }

  createPlan(request: InstallmentPlanRequest): Observable<InstallmentPlan> {
    return this.http.post<InstallmentPlan>(PLANS_URL, request);
  }

  cancelPlan(planId: string): Observable<InstallmentPlan> {
    return this.http.post<InstallmentPlan>(`${PLANS_URL}/${planId}/cancel`, null);
  }

  /** El suscriptor pagó por anticipado lo que faltaba: deja de cobrarse en sus facturas. */
  prepayPlan(planId: string): Observable<InstallmentPlan> {
    return this.http.post<InstallmentPlan>(`${PLANS_URL}/${planId}/prepay`, null);
  }

  revertPrepayment(planId: string): Observable<InstallmentPlan> {
    return this.http.post<InstallmentPlan>(`${PLANS_URL}/${planId}/revert-prepayment`, null);
  }

  /** Crea el cobro y una financiación para cada suscriptor activo. Solo el administrador. */
  createGlobalCharge(request: GlobalChargeRequest): Observable<GlobalCharge> {
    return this.http.post<GlobalCharge>(GLOBAL_CHARGES_URL, request);
  }

  /** Aplica el cobro a un suscriptor que no lo tiene, por ejemplo uno registrado después. */
  addChargeSubscriber(chargeId: string, subscriberId: string): Observable<InstallmentPlan> {
    return this.http.post<InstallmentPlan>(`${GLOBAL_CHARGES_URL}/${chargeId}/subscribers`, {
      subscriberId,
    });
  }

  cancelGlobalCharge(chargeId: string): Observable<GlobalCharge> {
    return this.http.post<GlobalCharge>(`${GLOBAL_CHARGES_URL}/${chargeId}/cancel`, null);
  }

  /** Solo si todavía no se ha facturado ninguna cuota. */
  deleteGlobalCharge(chargeId: string): Observable<void> {
    return this.http.delete<void>(`${GLOBAL_CHARGES_URL}/${chargeId}`);
  }

  /** La factura en PDF, para descargarla o imprimirla. */
  pdf(invoiceId: string): Observable<Blob> {
    return this.http.get(`${INVOICES_URL}/${invoiceId}/pdf`, { responseType: 'blob' });
  }

  /** Todas las facturas de un periodo en un solo PDF, una por página. */
  periodPdf(periodId: string): Observable<Blob> {
    return this.http.get(`/api/v1/billing-periods/${periodId}/invoices/pdf`, {
      responseType: 'blob',
    });
  }

  updateSettings(settings: BillingSettings): Observable<BillingSettings> {
    return this.http.put<BillingSettings>(BILLING_SETTINGS_URL, settings);
  }
}
