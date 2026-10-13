import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ServiceType } from '../organizations/organization.models';
import {
  PortalLink,
  Property,
  PropertyRequest,
  Subscriber,
  SubscriberRequest,
} from './subscriber.models';

export const SUBSCRIBERS_URL = '/api/v1/subscribers';
export const PROPERTIES_URL = '/api/v1/properties';
/** Prestador de la sesión: de aquí salen los servicios que se pueden conectar a un predio. */
export const CURRENT_ORGANIZATION_URL = '/api/v1/organizations/current';

/** Operaciones de escritura. Las lecturas se hacen con `httpResource` en cada página. */
@Injectable({ providedIn: 'root' })
export class SubscribersApi {
  private readonly http = inject(HttpClient);

  register(request: SubscriberRequest): Observable<Subscriber> {
    return this.http.post<Subscriber>(SUBSCRIBERS_URL, request);
  }

  update(id: string, request: SubscriberRequest): Observable<Subscriber> {
    return this.http.put<Subscriber>(`${SUBSCRIBERS_URL}/${id}`, request);
  }

  deactivate(id: string): Observable<Subscriber> {
    return this.http.post<Subscriber>(`${SUBSCRIBERS_URL}/${id}/deactivate`, null);
  }

  activate(id: string): Observable<Subscriber> {
    return this.http.post<Subscriber>(`${SUBSCRIBERS_URL}/${id}/activate`, null);
  }

  /** El enlace anterior y el QR de las facturas ya impresas dejan de funcionar. */
  rotatePortalLink(id: string): Observable<PortalLink> {
    return this.http.post<PortalLink>(`${SUBSCRIBERS_URL}/${id}/portal-link/rotate`, null);
  }

  addProperty(subscriberId: string, request: PropertyRequest): Observable<Property> {
    return this.http.post<Property>(`${SUBSCRIBERS_URL}/${subscriberId}/properties`, request);
  }

  updateProperty(propertyId: string, request: PropertyRequest): Observable<Property> {
    return this.http.put<Property>(`${PROPERTIES_URL}/${propertyId}`, request);
  }

  /** Conecta el servicio o, si ya está conectado, cambia su medidor. */
  connectService(
    propertyId: string,
    service: ServiceType,
    meterSerial: string | null,
  ): Observable<Property> {
    return this.http.put<Property>(`${PROPERTIES_URL}/${propertyId}/services/${service}`, {
      meterSerial,
    });
  }

  suspendService(propertyId: string, service: ServiceType): Observable<Property> {
    return this.http.post<Property>(
      `${PROPERTIES_URL}/${propertyId}/services/${service}/suspend`,
      null,
    );
  }

  reconnectService(propertyId: string, service: ServiceType): Observable<Property> {
    return this.http.post<Property>(
      `${PROPERTIES_URL}/${propertyId}/services/${service}/reconnect`,
      null,
    );
  }

  disconnectService(propertyId: string, service: ServiceType): Observable<Property> {
    return this.http.delete<Property>(`${PROPERTIES_URL}/${propertyId}/services/${service}`);
  }
}
