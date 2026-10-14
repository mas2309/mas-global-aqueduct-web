# MasGlobalAqueductWeb

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Despliegue en stage

Un tag `vX.Y.Z-rcN` dispara [deploy-stage.yml](.github/workflows/deploy-stage.yml): corre `npm run verify`,
construye una imagen por aplicación (`mas-global-aqueduct-backoffice` y `mas-global-aqueduct-portal`) y levanta
los dos contenedores en la VPS, en la red `mas-network`, sin puerto publicado.

```bash
git tag v0.1.0-rc1 && git push origin v0.1.0-rc1
```

Cada contenedor sirve su aplicación y reenvía `/api` al backend (`mas-global-aqueduct-service:8090`) por la red
interna, así que el backend debe estar desplegado. No hay configuración por entorno en el código: la API
siempre es `/api` del mismo dominio.

Preparación, una sola vez:

1. Environment `stage` en GitHub con los secretos `VPS_HOST`, `VPS_USER`, `VPS_PASSWORD` y `GHCR_TOKEN` (y,
   si se quieren notificaciones, las variables `SLACK_WEBHOOK_URL` o `TEAMS_WEBHOOK_URL`).
2. Dominios en Cloudflare y bloques del Nginx central de la VPS:
   [infra/nginx/sandbox-massolutions.conf](infra/nginx/sandbox-massolutions.conf).

| Aplicación | Dominio de stage |
|------------|------------------|
| Backoffice | `https://acueductos.sandbox-massolutions.uk` |
| Portal del suscriptor | `https://acueductos-portal.sandbox-massolutions.uk/p/<token>` |
