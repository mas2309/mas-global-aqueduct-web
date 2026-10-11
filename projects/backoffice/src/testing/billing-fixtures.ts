import { BillingPeriod, Reading, RouteEntry } from '../app/features/readings/reading.models';
import { Tariff } from '../app/features/tariffs/tariff.models';
import { PROPERTY_ID, SUBSCRIBER_ID } from './subscriber-fixtures';

export const TARIFF_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const PERIOD_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
export const READING_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

export function tariff(overrides: Partial<Tariff> = {}): Tariff {
  return {
    id: TARIFF_ID,
    serviceType: 'WATER',
    validFrom: '2026-01-01',
    inEffect: true,
    fixedCharge: 8000,
    blocks: [
      { upTo: 10, pricePerUnit: 1500 },
      { upTo: null, pricePerUnit: 2500 },
    ],
    adjustments: [
      { usage: 'RESIDENTIAL', stratum: 1, percent: -50 },
      { usage: 'COMMERCIAL', stratum: null, percent: 20 },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function period(overrides: Partial<BillingPeriod> = {}): BillingPeriod {
  return {
    id: PERIOD_ID,
    year: 2026,
    month: 10,
    status: 'OPEN',
    openedAt: '2026-10-01T00:00:00Z',
    closedAt: null,
    ...overrides,
  };
}

export function reading(overrides: Partial<Reading> = {}): Reading {
  return {
    id: READING_ID,
    propertyId: PROPERTY_ID,
    serviceType: 'WATER',
    previousReading: 120,
    currentReading: 135,
    consumption: 15,
    meterReplaced: false,
    unusual: false,
    notes: null,
    readAt: '2026-10-05T00:00:00Z',
    ...overrides,
  };
}

export function routeEntry(overrides: Partial<RouteEntry> = {}): RouteEntry {
  return {
    propertyId: PROPERTY_ID,
    subscriberId: SUBSCRIBER_ID,
    subscriberCode: 42,
    subscriberName: 'María Gómez',
    address: 'Vereda El Hato, casa 12',
    sector: 'El Hato',
    meterSerial: 'MED-001',
    connectionStatus: 'ACTIVE',
    previousReading: 120,
    reading: null,
    ...overrides,
  };
}
