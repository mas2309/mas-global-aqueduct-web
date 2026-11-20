import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { access, authResponse } from '../../../../testing/fixtures';
import { invoice } from '../../../../testing/billing-fixtures';
import { PageTestContext, settle, setUpPage, textOf, type } from '../../../../testing/setup';
import { subscriber } from '../../../../testing/subscriber-fixtures';
import { INVOICES_URL } from '../../invoices/invoices-api';
import { SUBSCRIBERS_URL } from '../../subscribers/subscribers-api';
import { CollectionPage, looksLikeQr } from './collection-page';

const QR = 'https://portal.mas.co/p/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd';

describe('looksLikeQr', () => {
  it('reconoce el QR de la factura o su token', () => {
    expect(looksLikeQr(QR)).toBe(true);
    expect(looksLikeQr('AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd')).toBe(true);
    expect(looksLikeQr('María Gómez')).toBe(false);
    expect(looksLikeQr('42')).toBe(false);
  });
});

describe('CollectionPage', () => {
  let context: PageTestContext;
  let fixture: ComponentFixture<CollectionPage>;
  let element: HTMLElement;

  afterEach(() => context.http.verify());

  async function render(): Promise<void> {
    context = setUpPage({
      session: authResponse({ organization: access({ role: 'COLLECTOR' }) }),
      providers: [
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
      ],
    });
    fixture = TestBed.createComponent(CollectionPage);
    element = fixture.nativeElement;
    await settle();
  }

  async function search(text: string): Promise<void> {
    type(element, 'input[name=query]', text);
    await settle();
    element.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await settle();
  }

  function button(label: string): HTMLButtonElement {
    return [...element.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
      textOf(candidate).includes(label),
    )!;
  }

  it('con el QR encuentra al suscriptor, cobra el documento y ofrece el comprobante', async () => {
    await render();
    await search(QR);

    const lookup = context.http.expectOne(
      (request) => request.url === `${SUBSCRIBERS_URL}/by-code`,
    );
    expect(lookup.request.params.get('code')).toBe(QR);
    lookup.flush(subscriber());
    await settle();
    // Acueducto y aseo comparten número: se cobran juntos
    context.http
      .expectOne((request) => request.url === INVOICES_URL)
      .flush({
        items: [
          invoice({ id: 'agua', number: 12, total: 25500, state: 'OVERDUE' }),
          invoice({ id: 'aseo', number: 12, total: 6000, serviceType: 'SANITATION' }),
          invoice({ id: 'vieja', number: 11, state: 'CARRIED' }),
        ],
        page: 0,
        size: 50,
        totalItems: 3,
        totalPages: 1,
      });
    await settle();

    const text = textOf(element);
    expect(text).toContain('Factura n.º 12');
    expect(text).not.toContain('Factura n.º 11');
    expect(text).toContain('$31,500');

    button('Cobrar en efectivo').click();
    context.http.expectOne(`${INVOICES_URL}/agua/document`).flush([]);
    const payment = context.http.expectOne(`${INVOICES_URL}/agua/pay`);
    expect(payment.request.body).toEqual({ method: 'CASH' });
    payment.flush(invoice({ id: 'agua', number: 12, state: 'PAID' }));
    await settle();
    context.http
      .expectOne((request) => request.url === INVOICES_URL)
      .flush({ items: [], page: 0, size: 50, totalItems: 0, totalPages: 0 });
    await settle();

    expect(textOf(element)).toContain('Pago de la factura n.º 12 registrado');
    expect(button('Imprimir comprobante')).toBeTruthy();
    expect(button('Factura pagada (PDF)')).toBeTruthy();
  });

  it('busca por nombre y deja elegir entre varios', async () => {
    await render();
    await search('Gómez');

    context.http
      .expectOne(
        (request) => request.url === SUBSCRIBERS_URL && request.params.get('q') === 'Gómez',
      )
      .flush({
        items: [
          subscriber({ id: 's1', code: 1, fullName: 'María Gómez' }),
          subscriber({ id: 's2', code: 2, fullName: 'Pedro Gómez' }),
        ],
        page: 0,
        size: 20,
        totalItems: 2,
        totalPages: 1,
      });
    await settle();

    expect(textOf(element)).toContain('Elige el suscriptor');
    button('Pedro Gómez').click();
    await settle();
    const request = context.http.expectOne((candidate) => candidate.url === INVOICES_URL);
    expect(request.request.params.get('subscriberId')).toBe('s2');
    request.flush({ items: [], page: 0, size: 50, totalItems: 0, totalPages: 0 });
    await settle();
    expect(textOf(element)).toContain('No tiene facturas pendientes');
  });
});
