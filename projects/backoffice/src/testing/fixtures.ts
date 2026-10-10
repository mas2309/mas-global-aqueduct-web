import { AuthResponse, OrganizationAccess, User } from '../app/core/auth/auth.models';
import { Organization } from '../app/features/organizations/organization.models';

/** Datos de prueba con la misma forma que las respuestas del backend. */

export const AQUEDUCT_ID = '11111111-1111-1111-1111-111111111111';
export const UTILITY_ID = '22222222-2222-2222-2222-222222222222';

export function user(overrides: Partial<User> = {}): User {
  return {
    id: '99999999-9999-9999-9999-999999999999',
    email: 'ana@elhato.co',
    fullName: 'Ana Pérez',
    platformAdmin: false,
    status: 'ACTIVE',
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

export function access(overrides: Partial<OrganizationAccess> = {}): OrganizationAccess {
  return {
    organizationId: AQUEDUCT_ID,
    name: 'Acueducto El Hato',
    active: true,
    role: 'OPERATOR',
    inherited: false,
    ...overrides,
  };
}

export function authResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  const organization = access();
  return {
    tokenType: 'Bearer',
    accessToken: 'access-1',
    expiresIn: 900,
    accessTokenExpiresAt: '2026-10-07T12:15:00Z',
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2026-11-06T12:00:00Z',
    user: user(),
    organization,
    organizations: [organization],
    ...overrides,
  };
}

export function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: AQUEDUCT_ID,
    nit: '900123456-8',
    legalName: 'Asociación de Usuarios Acueducto El Hato',
    tradeName: 'Acueducto El Hato',
    type: 'COMMUNITY_AQUEDUCT',
    status: 'ACTIVE',
    municipalityCode: '25899',
    email: null,
    phone: null,
    services: ['WATER'],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

/** `Storage` en memoria para no depender de sessionStorage del navegador. */
export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
