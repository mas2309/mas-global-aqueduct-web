import { OrganizationRole, UserStatus } from '../../core/auth/auth.models';

/** Contratos de /api/v1/organizations/{id}/members (módulo identity del backend). */

export interface Member {
  userId: string;
  email: string;
  fullName: string;
  role: OrganizationRole;
  userStatus: UserStatus;
  memberSince: string;
  /** Solo al agregar: la cuenta se creó ahora y hay que entregarle la contraseña temporal. */
  accountCreated: boolean;
}

/** `fullName` y `password` solo se usan si el correo aún no tiene cuenta. */
export interface AddMemberRequest {
  email: string;
  role: OrganizationRole;
  fullName?: string;
  password?: string;
}

/** Prestador cuyos usuarios se administran. */
export interface MemberTarget {
  organizationId: string;
  name: string;
}

export const ORGANIZATION_ROLES: readonly OrganizationRole[] = ['ORG_ADMIN', 'OPERATOR', 'VIEWER'];

/** Qué puede hacer cada rol, para que quien asigna el acceso elija con criterio. */
export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  ORG_ADMIN: 'Administra usuarios y configuración',
  OPERATOR: 'Registra lecturas, factura y recauda',
  VIEWER: 'Solo consulta',
};
