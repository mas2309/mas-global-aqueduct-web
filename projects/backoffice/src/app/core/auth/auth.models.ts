/** Contratos de /api/v1/auth. Reflejan los DTO del módulo identity de mas-global-aqueduct-service. */

export type OrganizationRole = 'ORG_ADMIN' | 'OPERATOR' | 'VIEWER';

export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  platformAdmin: boolean;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Prestador al que el usuario puede entrar. `inherited`: acceso vía la ESP o municipio al que está vinculado. */
export interface OrganizationAccess {
  organizationId: string;
  name: string;
  active: boolean;
  role: OrganizationRole;
  inherited: boolean;
}

export interface AuthResponse {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: User;
  organization: OrganizationAccess | null;
  organizations: OrganizationAccess[];
}

export interface Profile {
  user: User;
  organization: OrganizationAccess | null;
  organizations: OrganizationAccess[];
}
