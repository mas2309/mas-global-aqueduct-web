import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MoneyInput, parseAmount } from './money-input';

describe('parseAmount', () => {
  it('entiende los montos como se escriben en Colombia', () => {
    expect(parseAmount('30000')).toBe(30000);
    expect(parseAmount('30.000')).toBe(30000);
    expect(parseAmount('$ 30.000')).toBe(30000);
    expect(parseAmount('1.250.000')).toBe(1250000);
    expect(parseAmount('30.000,50')).toBe(30000.5);
    expect(parseAmount('30000.50')).toBe(30000.5);
    expect(parseAmount('1,5')).toBe(1.5);
  });

  it('vacío es null y lo que no es un monto, undefined', () => {
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('treinta')).toBeUndefined();
    expect(parseAmount('30.000.5')).toBeUndefined();
  });
});

@Component({
  imports: [ReactiveFormsModule, MoneyInput],
  template: `<input aqMoney [formControl]="amount" />`,
})
class Host {
  readonly amount = new FormControl<number | null>(25000);
}

describe('MoneyInput', () => {
  it('muestra el valor con puntos de miles y entrega un número al formulario', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(input.type).toBe('text');
    expect(input.value).toBe('25.000');

    input.value = '30.000';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.amount.value).toBe(30000);
    expect(fixture.componentInstance.amount.valid).toBe(true);

    input.value = 'treinta';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.amount.hasError('amount')).toBe(true);
  });
});
