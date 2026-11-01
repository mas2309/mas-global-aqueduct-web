import { Routes } from '@angular/router';
import {
  authGuard,
  guestGuard,
  organizationAdminGuard,
  organizationGuard,
  passwordChangedGuard,
  platformAdminGuard,
} from './core/auth/guards';

/** Rutas en español: son las que ve el usuario en la barra de direcciones. */
export const routes: Routes = [
  {
    path: 'ingresar',
    title: 'Ingresar · MAS Acueductos',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    // Diferido: el login (lo primero que ve el usuario) no descarga el menú ni la barra superior
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      {
        path: 'cambiar-clave',
        title: 'Cambiar contraseña · MAS Acueductos',
        loadComponent: () =>
          import('./features/auth/change-password/change-password').then((m) => m.ChangePassword),
      },
      {
        path: '',
        canActivateChild: [passwordChangedGuard],
        children: [
          {
            path: 'seleccionar-prestador',
            title: 'Seleccionar prestador · MAS Acueductos',
            loadComponent: () =>
              import('./features/auth/select-organization/select-organization').then(
                (m) => m.SelectOrganization,
              ),
          },
          {
            path: 'inicio',
            title: 'Inicio · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () => import('./features/home/home').then((m) => m.Home),
          },
          {
            path: 'suscriptores',
            canActivateChild: [organizationGuard],
            children: [
              {
                path: '',
                title: 'Suscriptores · MAS Acueductos',
                loadComponent: () =>
                  import('./features/subscribers/subscriber-list/subscriber-list').then(
                    (m) => m.SubscriberList,
                  ),
              },
              {
                path: 'importar',
                title: 'Importar suscriptores · MAS Acueductos',
                loadComponent: () =>
                  import('./features/subscribers/subscriber-import/subscriber-import').then(
                    (m) => m.SubscriberImport,
                  ),
              },
              {
                path: 'nuevo',
                title: 'Nuevo suscriptor · MAS Acueductos',
                loadComponent: () =>
                  import('./features/subscribers/subscriber-form/subscriber-form').then(
                    (m) => m.SubscriberForm,
                  ),
              },
              {
                path: ':id/editar',
                title: 'Editar suscriptor · MAS Acueductos',
                loadComponent: () =>
                  import('./features/subscribers/subscriber-form/subscriber-form').then(
                    (m) => m.SubscriberForm,
                  ),
              },
              {
                path: ':id',
                title: 'Suscriptor · MAS Acueductos',
                loadComponent: () =>
                  import('./features/subscribers/subscriber-detail/subscriber-detail').then(
                    (m) => m.SubscriberDetail,
                  ),
              },
            ],
          },
          {
            path: 'lecturas',
            title: 'Lecturas · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/readings/readings/readings').then((m) => m.Readings),
          },
          {
            path: 'facturas',
            title: 'Facturas · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/invoices/invoice-list/invoice-list').then((m) => m.InvoiceList),
          },
          {
            path: 'facturas/:id',
            title: 'Factura · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/invoices/invoice-detail/invoice-detail').then(
                (m) => m.InvoiceDetail,
              ),
          },
          {
            path: 'financiaciones',
            title: 'Financiaciones · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/invoices/plan-overview/plan-overview').then((m) => m.PlanOverview),
          },
          {
            path: 'informes',
            title: 'Informes · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/reports/collections-report/collections-report').then(
                (m) => m.CollectionsReport,
              ),
          },
          {
            path: 'finanzas',
            title: 'Ingresos y gastos · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/finance/movement-list/movement-list').then((m) => m.MovementList),
          },
          {
            path: 'cobros-globales',
            title: 'Cobros globales · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/invoices/global-charges/global-charges').then(
                (m) => m.GlobalCharges,
              ),
          },
          {
            path: 'documentos',
            title: 'Documentos · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/documents/document-list/document-list').then(
                (m) => m.DocumentList,
              ),
          },
          {
            path: 'pqr',
            title: 'PQR · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/claims/claim-list/claim-list').then((m) => m.ClaimList),
          },
          {
            path: 'pqr/:id',
            title: 'PQR · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/claims/claim-detail/claim-detail').then((m) => m.ClaimDetail),
          },
          {
            path: 'cortes',
            title: 'Suspensión y corte · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/disconnections/disconnections-page/disconnections-page').then(
                (m) => m.DisconnectionsPage,
              ),
          },
          {
            path: 'sui',
            title: 'Archivos SUI · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () => import('./features/sui/sui-page/sui-page').then((m) => m.SuiPage),
          },
          {
            path: 'areas',
            title: 'Áreas de prestación · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/service-areas/service-area-list/service-area-list').then(
                (m) => m.ServiceAreaList,
              ),
          },
          {
            path: 'liquidaciones',
            title: 'Liquidación de MAS · MAS Acueductos',
            canActivate: [platformAdminGuard],
            loadComponent: () =>
              import('./features/settlements/settlement-list/settlement-list').then(
                (m) => m.SettlementList,
              ),
          },
          {
            path: 'perfil-regulatorio',
            title: 'Perfil regulatorio · MAS Acueductos',
            canActivate: [organizationAdminGuard],
            loadComponent: () =>
              import('./features/regulatory/regulatory-profile/regulatory-profile').then(
                (m) => m.RegulatoryProfilePage,
              ),
          },
          {
            path: 'tarifas',
            title: 'Tarifas · MAS Acueductos',
            canActivate: [organizationGuard],
            loadComponent: () =>
              import('./features/tariffs/tariff-list/tariff-list').then((m) => m.TariffList),
          },
          {
            path: 'tarifas/nueva',
            title: 'Nueva tarifa · MAS Acueductos',
            canActivate: [organizationAdminGuard],
            loadComponent: () =>
              import('./features/tariffs/tariff-form/tariff-form').then((m) => m.TariffForm),
          },
          {
            path: 'usuarios',
            title: 'Usuarios · MAS Acueductos',
            canActivate: [organizationAdminGuard],
            loadComponent: () =>
              import('./features/members/member-list/member-list').then((m) => m.MemberList),
          },
          {
            path: 'prestadores',
            canActivateChild: [platformAdminGuard],
            children: [
              {
                path: '',
                title: 'Prestadores · MAS Acueductos',
                loadComponent: () =>
                  import('./features/organizations/organization-list/organization-list').then(
                    (m) => m.OrganizationList,
                  ),
              },
              {
                path: 'nuevo',
                title: 'Vincular prestador · MAS Acueductos',
                loadComponent: () =>
                  import('./features/organizations/organization-form/organization-form').then(
                    (m) => m.OrganizationForm,
                  ),
              },
              {
                path: ':id/editar',
                title: 'Editar prestador · MAS Acueductos',
                loadComponent: () =>
                  import('./features/organizations/organization-form/organization-form').then(
                    (m) => m.OrganizationForm,
                  ),
              },
              {
                path: ':id',
                title: 'Prestador · MAS Acueductos',
                loadComponent: () =>
                  import('./features/organizations/organization-detail/organization-detail').then(
                    (m) => m.OrganizationDetail,
                  ),
              },
            ],
          },
          { path: '', pathMatch: 'full', redirectTo: 'inicio' },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
