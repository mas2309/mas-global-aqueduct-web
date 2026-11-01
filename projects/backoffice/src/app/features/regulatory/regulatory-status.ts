import { httpResource } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { SessionStore } from '../../core/auth/session-store';
import { REGULATORY_PROFILE_URL, RegulatoryProfile } from './regulatory.models';

/**
 * Lo que el menú necesita del perfil regulatorio del prestador actual, que gestiona el administrador de plataforma.
 * Quien no reporta al SUI no ve sus archivos. Si el perfil no se puede leer se muestran, para no esconderle sus
 * herramientas a un prestador regulado.
 */
@Injectable({ providedIn: 'root' })
export class RegulatoryStatus {
  private readonly session = inject(SessionStore);

  /** Un objeto nuevo en cada cambio de prestador: así se vuelve a consultar aunque la URL sea la misma. */
  private readonly profile = httpResource<RegulatoryProfile>(() =>
    this.session.organization() ? { url: REGULATORY_PROFILE_URL } : undefined,
  );

  readonly reportsToSui = computed(() =>
    this.profile.hasValue() ? this.profile.value().rules.reportsToSui : !!this.profile.error(),
  );
}
