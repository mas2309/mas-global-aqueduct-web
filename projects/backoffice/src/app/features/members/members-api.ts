import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { OrganizationRole } from '../../core/auth/auth.models';
import { AddMemberRequest, Member } from './member.models';

export function membersUrl(organizationId: string): string {
  return `/api/v1/organizations/${organizationId}/members`;
}

@Injectable({ providedIn: 'root' })
export class MembersApi {
  private readonly http = inject(HttpClient);

  /** Da acceso al prestador o, si ya lo tiene, cambia su rol. */
  add(organizationId: string, request: AddMemberRequest): Observable<Member> {
    return this.http.post<Member>(membersUrl(organizationId), request);
  }

  /** Cambia el rol y, si la cuenta es solo de este prestador, el nombre. */
  update(
    organizationId: string,
    userId: string,
    request: { fullName: string | null; role: OrganizationRole },
  ): Observable<Member> {
    return this.http.put<Member>(`${membersUrl(organizationId)}/${userId}`, request);
  }

  /** Contraseña temporal: la persona debe cambiarla al ingresar y se cierran sus sesiones. */
  resetPassword(organizationId: string, userId: string, password: string): Observable<void> {
    return this.http.post<void>(`${membersUrl(organizationId)}/${userId}/password`, { password });
  }

  remove(organizationId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${membersUrl(organizationId)}/${userId}`);
  }
}
