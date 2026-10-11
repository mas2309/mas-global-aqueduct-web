import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ServiceType } from '../organizations/organization.models';
import { PropertyUsage } from '../subscribers/subscriber.models';
import { Tariff, TariffCharge, TariffRequest } from './tariff.models';

export const TARIFFS_URL = '/api/v1/tariffs';

@Injectable({ providedIn: 'root' })
export class TariffsApi {
  private readonly http = inject(HttpClient);

  create(request: TariffRequest): Observable<Tariff> {
    return this.http.post<Tariff>(TARIFFS_URL, request);
  }

  /** Solo se pueden eliminar versiones que aún no han entrado en vigencia. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${TARIFFS_URL}/${id}`);
  }

  /** Cuánto pagaría un predio por un consumo con la tarifa vigente. */
  estimate(
    serviceType: ServiceType,
    consumption: number,
    usage: PropertyUsage,
    stratum: number | null,
  ): Observable<TariffCharge> {
    const params: Record<string, string | number> = { serviceType, consumption, usage };
    if (stratum !== null) {
      params['stratum'] = stratum;
    }
    return this.http.get<TariffCharge>(`${TARIFFS_URL}/estimate`, { params });
  }
}
