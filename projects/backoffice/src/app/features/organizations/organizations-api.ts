import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Affiliation,
  Organization,
  RegisterOrganizationRequest,
  ServiceType,
  UpdateOrganizationRequest,
} from './organization.models';

export const ORGANIZATIONS_URL = '/api/v1/organizations';
export const AFFILIATIONS_URL = '/api/v1/affiliations';

/** Operaciones de escritura. Las lecturas se hacen con `httpResource` en cada página. */
@Injectable({ providedIn: 'root' })
export class OrganizationsApi {
  private readonly http = inject(HttpClient);

  register(request: RegisterOrganizationRequest): Observable<Organization> {
    return this.http.post<Organization>(ORGANIZATIONS_URL, request);
  }

  update(id: string, request: UpdateOrganizationRequest): Observable<Organization> {
    return this.http.put<Organization>(`${ORGANIZATIONS_URL}/${id}`, request);
  }

  suspend(id: string): Observable<Organization> {
    return this.http.post<Organization>(`${ORGANIZATIONS_URL}/${id}/suspend`, null);
  }

  activate(id: string): Observable<Organization> {
    return this.http.post<Organization>(`${ORGANIZATIONS_URL}/${id}/activate`, null);
  }

  enableService(id: string, service: ServiceType): Observable<Organization> {
    return this.http.put<Organization>(`${ORGANIZATIONS_URL}/${id}/services/${service}`, null);
  }

  disableService(id: string, service: ServiceType): Observable<Organization> {
    return this.http.delete<Organization>(`${ORGANIZATIONS_URL}/${id}/services/${service}`);
  }

  affiliate(parentOrganizationId: string, childOrganizationId: string): Observable<Affiliation> {
    return this.http.post<Affiliation>(AFFILIATIONS_URL, {
      parentOrganizationId,
      childOrganizationId,
    });
  }

  endAffiliation(id: string): Observable<Affiliation> {
    return this.http.post<Affiliation>(`${AFFILIATIONS_URL}/${id}/end`, null);
  }
}
