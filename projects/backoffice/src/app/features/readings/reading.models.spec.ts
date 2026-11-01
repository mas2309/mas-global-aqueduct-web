import { nextPeriod, periodLabel } from './reading.models';

describe('periodos de facturación', () => {
  it('un periodo mensual se nombra por su mes', () => {
    expect(periodLabel({ year: 2026, month: 10 })).toBe('Octubre 2026');
    expect(periodLabel({ year: 2026, month: 10, months: 1 })).toBe('Octubre 2026');
  });

  it('un periodo de varios meses se nombra por el primero y el último', () => {
    expect(periodLabel({ year: 2026, month: 3, months: 2 })).toBe('Marzo a Abril 2026');
    expect(periodLabel({ year: 2026, month: 12, months: 2 })).toBe('Diciembre 2026 a Enero 2027');
  });

  it('el siguiente empieza después del último mes y conserva la periodicidad', () => {
    expect(nextPeriod({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1, months: 1 });
    expect(nextPeriod({ year: 2026, month: 3, months: 2 })).toEqual({
      year: 2026,
      month: 5,
      months: 2,
    });
    expect(nextPeriod({ year: 2026, month: 11, months: 3 })).toEqual({
      year: 2027,
      month: 2,
      months: 3,
    });
  });
});
