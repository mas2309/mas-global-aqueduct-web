import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Cualquier dirección que no sea la de un suscriptor: no hay nada que mostrar sin el enlace de la factura. */
@Component({
  selector: 'aq-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <div class="notice">
        <h1>Abre el enlace de tu factura</h1>
        <p>
          Para consultar tus facturas, escanea el código QR que viene en tu factura o abre el enlace
          que te envió tu prestador.
        </p>
      </div>
    </main>
  `,
})
export class NotFound {}
