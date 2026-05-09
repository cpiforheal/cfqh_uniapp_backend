FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG UMI_APP_API_BASE=/api
ARG UMI_APP_DEFAULT_ADMIN_TOKEN=
ENV UMI_APP_API_BASE=${UMI_APP_API_BASE}
ENV UMI_APP_DEFAULT_ADMIN_TOKEN=${UMI_APP_DEFAULT_ADMIN_TOKEN}

RUN pnpm build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
