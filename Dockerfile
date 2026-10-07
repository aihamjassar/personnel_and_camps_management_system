FROM node:22-bookworm-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci

COPY server ./server
COPY client ./client
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
# Prisma config requires a syntactically valid URL during client generation only;
# this is a non-routable build placeholder and is never copied into runtime env.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
RUN npm run build

FROM node:22-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/server ./server
USER node
EXPOSE 4000
CMD ["sh", "-c", "cd /app/server && npx prisma migrate deploy && npm run start"]

FROM caddy:2-alpine AS static
COPY --from=build /workspace/client/dist /srv
COPY deploy/staging/Caddyfile /etc/caddy/Caddyfile
