import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BillingPeriod, Reading, ReadingRequest, ReviewRequest } from './reading.models';

export const PERIODS_URL = '/api/v1/billing-periods';
export const READINGS_URL = '/api/v1/readings';

@Injectable({ providedIn: 'root' })
export class ReadingsApi {
  private readonly http = inject(HttpClient);

  /** Sin `months`, el periodo conserva la periodicidad del anterior. */
  openPeriod(year: number, month: number, months?: number): Observable<BillingPeriod> {
    return this.http.post<BillingPeriod>(PERIODS_URL, { year, month, months });
  }

  closePeriod(periodId: string): Observable<BillingPeriod> {
    return this.http.post<BillingPeriod>(`${PERIODS_URL}/${periodId}/close`, null);
  }

  /** Registra la lectura de un predio o corrige la que ya tenga en el periodo. */
  record(periodId: string, request: ReadingRequest): Observable<Reading> {
    return this.http.put<Reading>(`${PERIODS_URL}/${periodId}/readings`, request);
  }

  /** Resuelve una lectura con desviación: al hacerlo se genera su factura. */
  review(readingId: string, request: ReviewRequest): Observable<Reading> {
    return this.http.post<Reading>(`${READINGS_URL}/${readingId}/review`, request);
  }

  delete(readingId: string): Observable<void> {
    return this.http.delete<void>(`${READINGS_URL}/${readingId}`);
  }
}
