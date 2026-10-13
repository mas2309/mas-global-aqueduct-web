import { InstallmentPlan, Invoice } from '../app/features/invoices/invoice.models';
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

export const INVOICE_ID = '99999999-9999-9999-9999-999999999999';
export const PLAN_ID = '88888888-8888-8888-8888-888888888888';

export function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: INVOICE_ID,
    number: 12,
    periodId: PERIOD_ID,
    year: 2026,
    month: 10,
    readingId: READING_ID,
    propertyId: PROPERTY_ID,
    subscriberId: SUBSCRIBER_ID,
    subscriberCode: 42,
    subscriberName: 'María Gómez',
    address: 'Vereda El Hato, casa 12',
    serviceType: 'WATER',
    previousReading: 120,
    currentReading: 135,
    consumption: 15,
    fixedCharge: 8000,
    consumptionCharge: 17500,
    adjustmentPercent: 0,
    adjustment: 0,
    previousDebt: 0,
    lateFee: 0,
    otherCharges: 0,
    otherChargesDescription: null,
    installments: [],
    total: 25500,
    dueDate: '2026-11-20',
    state: 'PENDING',
    paymentMethod: null,
    paidAt: null,
    issuedAt: '2026-10-05T00:00:00Z',
    ...overrides,
  };
}

export function plan(overrides: Partial<InstallmentPlan> = {}): InstallmentPlan {
  return {
    id: PLAN_ID,
    subscriberId: SUBSCRIBER_ID,
    description: 'Medidor nuevo',
    totalAmount: 120000,
    installments: 6,
    billed: 2,
    installmentAmount: 20000,
    pendingAmount: 80000,
    status: 'ACTIVE',
    globalChargeId: null,
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}
