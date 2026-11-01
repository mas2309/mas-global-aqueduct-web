import { Property, Subscriber } from '../app/features/subscribers/subscriber.models';

export const SUBSCRIBER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const PROPERTY_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

export function subscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: SUBSCRIBER_ID,
    code: 42,
    fullName: 'María Gómez',
    documentType: 'CC',
    documentNumber: '52123456',
    email: null,
    phone: '3001234567',
    status: 'ACTIVE',
    associate: false,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

export function property(overrides: Partial<Property> = {}): Property {
  return {
    id: PROPERTY_ID,
    subscriberId: SUBSCRIBER_ID,
    code: 7,
    address: 'Vereda El Hato, casa 12',
    sector: 'El Hato',
    usage: 'RESIDENTIAL',
    stratum: 2,
    cadastralNumber: null,
    cadastralAddress: null,
    municipalityCode: null,
    settlementCode: null,
    serviceAreaId: null,
    services: [],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}
