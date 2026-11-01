import { httpResource } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { SessionStore } from '../../core/auth/session-store';
import { REGULATORY_PROFILE_URL, RegulatoryProfile } from './regulatory.models';

/**
 * Perfil regulatorio del prestador actual, compartido por el menú y su pantalla. Sin marco el menú queda básico: lo
 * normativo no estorba a quien no lo necesita. Si el perfil no se puede leer se muestra todo, para no esconderle
 * sus herramientas a un prestador regulado.
 */
@Injectable({ providedIn: 'root' })
export class RegulatoryStatus {
  private readonly session = inject(SessionStore);

  /** Un objeto nuevo en cada cambio de prestador: así se vuelve a consultar aunque la URL sea la misma. */
  readonly profile = httpResource<RegulatoryProfile>(() =>
    this.session.organization() ? { url: REGULATORY_PROFILE_URL } : undefined,
  );

  readonly regulated = computed(() =>
    this.profile.hasValue() ? this.profile.value().framework !== 'NONE' : !!this.profile.error(),
  );

  readonly reportsToSui = computed(() =>
    this.profile.hasValue() ? this.profile.value().rules.reportsToSui : !!this.profile.error(),
  );
}
