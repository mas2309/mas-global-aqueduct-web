import { Routes } from '@angular/router';
import { NotFound } from './not-found/not-found';
import { PortalPage } from './portal-page/portal-page';

/** El portal tiene una sola página: la del suscriptor dueño del token que va en el QR de la factura. */
export const routes: Routes = [
  { path: 'p/:token', component: PortalPage, title: 'Mis facturas' },
  { path: '**', component: NotFound, title: 'Enlace no encontrado' },
];
