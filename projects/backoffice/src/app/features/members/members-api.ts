import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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

  remove(organizationId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${membersUrl(organizationId)}/${userId}`);
  }
}
