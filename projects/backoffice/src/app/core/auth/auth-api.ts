import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthResponse, Profile } from './auth.models';

export const AUTH_URL = '/api/v1/auth';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(email: string, password: string, organizationId?: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${AUTH_URL}/login`, { email, password, organizationId });
  }

  refresh(refreshToken: string, organizationId?: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${AUTH_URL}/refresh`, { refreshToken, organizationId });
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(`${AUTH_URL}/logout`, { refreshToken });
  }

  me(): Observable<Profile> {
    return this.http.get<Profile>(`${AUTH_URL}/me`);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${AUTH_URL}/password`, { currentPassword, newPassword });
  }
}
