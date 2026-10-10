import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Mismo algoritmo (módulo 11 de la DIAN) que `Nit` en el backend. */
const WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
const NUMBER = /^\d{5,15}$/;

export interface ParsedNit {
  number: string;
  checkDigit: number;
}

export function computeCheckDigit(number: string): number {
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    sum += Number(number[number.length - 1 - i]) * WEIGHTS[i];
  }
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : remainder;
}

/** Acepta `900123456-8` o `900.123.456-8`. Devuelve `null` si el formato no es válido. */
export function parseNit(raw: string): ParsedNit | null {
  const clean = raw.replace(/[.\s]/g, '');
  const match = /^(\d+)-(\d)$/.exec(clean);
  if (!match || !NUMBER.test(match[1])) {
    return null;
  }
  return { number: match[1], checkDigit: Number(match[2]) };
}

/** Errores: `nitFormat` (falta el DV o hay caracteres inválidos) y `nitCheckDigit` (con el DV correcto). */
export const nitValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return null;
  }
  const nit = parseNit(value);
  if (!nit) {
    return { nitFormat: true };
  }
  const expected = computeCheckDigit(nit.number);
  return nit.checkDigit === expected ? null : { nitCheckDigit: { expected } };
};
