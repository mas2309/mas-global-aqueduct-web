import { FormControl } from '@angular/forms';
import { computeCheckDigit, nitValidator, parseNit } from './nit';

describe('NIT', () => {
  it.each([
    ['800197268', 4],
    ['900123456', 8],
    ['901000001', 6],
    ['811111111', 8],
    ['00004', 1],
    ['00000', 0],
  ])('calcula el DV de %s igual que la DIAN y el backend', (number, expected) => {
    expect(computeCheckDigit(number)).toBe(expected);
  });

  it('interpreta formatos comunes', () => {
    expect(parseNit('900.123.456-8')).toEqual({ number: '900123456', checkDigit: 8 });
    expect(parseNit(' 900 123 456-8 ')).toEqual({ number: '900123456', checkDigit: 8 });
    expect(parseNit('9001234568')).toBeNull();
    expect(parseNit('1234-5')).toBeNull();
    expect(parseNit('90012A456-8')).toBeNull();
  });

  it('valida el control del formulario', () => {
    expect(nitValidator(new FormControl(''))).toBeNull();
    expect(nitValidator(new FormControl('900123456-8'))).toBeNull();
    expect(nitValidator(new FormControl('900123456'))).toEqual({ nitFormat: true });
    expect(nitValidator(new FormControl('900123456-7'))).toEqual({
      nitCheckDigit: { expected: 8 },
    });
  });
});
