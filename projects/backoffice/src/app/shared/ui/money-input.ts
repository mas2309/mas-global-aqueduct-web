import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';

/**
 * Interpreta un monto en pesos como lo escribe una persona en Colombia, sin depender del idioma del navegador.
 * Acepta 30000, 30.000, $ 30.000, 30.000,50 y 30000.50. `null` si está vacío; `undefined` si no es un monto.
 *
 * Un `<input type="number">` toma el punto como decimal: «30.000» se guardaba como 30. El acueducto El Hato tuvo
 * ese error con los otros cobros y se corrigió igual.
 */
export function parseAmount(text: string): number | null | undefined {
  let clean = text.replace(/[\s$]/g, '');
  if (clean === '') {
    return null;
  }
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    clean = clean.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(clean)) {
    return undefined;
  }
  return Number(clean);
}

/** El monto como se lee en Colombia: 30.000 y 1.250,5. */
function formatAmount(value: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value);
}

/**
 * Campo de monto en pesos: `<input matInput aqMoney formControlName="amount" />`. Es un campo de texto que entrega
 * un número al formulario (o `null` vacío); si lo escrito no es un monto, el control queda con el error `amount`.
 */
@Directive({
  selector: 'input[aqMoney]',
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    '(input)': 'onInput($any($event.target).value)',
    '(blur)': 'onTouched()',
  },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInput), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => MoneyInput), multi: true },
  ],
})
export class MoneyInput implements ControlValueAccessor, Validator {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private onChange: (value: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;
  private invalid = false;

  writeValue(value: number | null | undefined): void {
    this.invalid = false;
    this.input.value = value === null || value === undefined ? '' : formatAmount(value);
  }

  registerOnChange(onChange: (value: number | null) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.input.disabled = disabled;
  }

  validate(): ValidationErrors | null {
    return this.invalid ? { amount: true } : null;
  }

  protected onInput(text: string): void {
    const amount = parseAmount(text);
    this.invalid = amount === undefined;
    this.onChange(amount ?? null);
  }
}
