# Build stage
FROM node:22.23.2-alpine AS build
WORKDIR /app
RUN npm install -g npm@11.20.0
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY angular.json tsconfig.json ./
COPY projects/ projects/
# Aplicación a construir: backoffice (por defecto) o portal
ARG APP=backoffice
RUN npx ng build ${APP}

# Runtime stage: nginx sin privilegios de root (puerto 8080)
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY infra/nginx/default.conf.template /etc/nginx/templates/default.conf.template
ARG APP=backoffice
COPY --from=build /app/dist/${APP}/browser /usr/share/nginx/html
# URL interna del backend; /api se publica en el mismo dominio (sin CORS)
ENV API_UPSTREAM=http://mas-global-aqueduct-service:8090
EXPOSE 8080