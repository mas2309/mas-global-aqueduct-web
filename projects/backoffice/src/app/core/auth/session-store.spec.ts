import { TestBed } from '@angular/core/testing';
import { access, authResponse, MemoryStorage, user } from '../../../testing/fixtures';
import { REFRESH_TOKEN_STORAGE, SessionStore } from './session-store';

describe('SessionStore', () => {
  let store: SessionStore;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: REFRESH_TOKEN_STORAGE, useValue: storage }],
    });
    store = TestBed.inject(SessionStore);
  });

  it('empieza sin sesión', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
    expect(store.organizations()).toEqual([]);
    expect(store.canAdministerOrganization()).toBe(false);
  });

  it('guarda el token de acceso en memoria y el de refresco en el almacenamiento', () => {
    store.start(authResponse());

    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('access-1');
    expect(store.refreshToken()).toBe('refresh-1');
    expect(storage.getItem('aq.refreshToken')).toBe('refresh-1');
    expect([...Array(storage.length).keys()].map((i) => storage.key(i))).not.toContain('access');
  });

  it('calcula permisos según el rol en el prestador', () => {
    store.start(authResponse({ organization: access({ role: 'ORG_ADMIN' }) }));
    expect(store.canAdministerOrganization()).toBe(true);

    store.start(authResponse({ user: user({ platformAdmin: true }), organization: null }));
    expect(store.isPlatformAdmin()).toBe(true);
    expect(store.canAdministerOrganization()).toBe(true);
  });

  it('actualiza el perfil sin perder el token', () => {
    store.start(authResponse());
    store.updateProfile({
      user: user({ fullName: 'Ana María' }),
      organization: null,
      organizations: [],
    });

    expect(store.user()?.fullName).toBe('Ana María');
    expect(store.organization()).toBeNull();
    expect(store.accessToken()).toBe('access-1');
  });

  it('ignora la actualización de perfil sin sesión y limpia todo al cerrar', () => {
    store.updateProfile({ user: user(), organization: null, organizations: [] });
    expect(store.isAuthenticated()).toBe(false);

    store.start(authResponse());
    store.clear();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.refreshToken()).toBeNull();
  });

  it('tolera un almacenamiento bloqueado', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: REFRESH_TOKEN_STORAGE, useValue: blocked }],
    });
    const blockedStore = TestBed.inject(SessionStore);

    blockedStore.start(authResponse());
    expect(blockedStore.isAuthenticated()).toBe(true);
    expect(blockedStore.refreshToken()).toBeNull();
    blockedStore.clear();
    expect(blockedStore.isAuthenticated()).toBe(false);
  });
});
