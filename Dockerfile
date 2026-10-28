# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app/FrontEnd
COPY FrontEnd/package.json FrontEnd/package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY *.csv /app/
COPY FrontEnd/ ./
RUN npm run build && npm run api:build

FROM node:24-bookworm-slim AS production-dependencies
WORKDIR /app/FrontEnd
COPY FrontEnd/package.json FrontEnd/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production AI_HOST=0.0.0.0 AI_PORT=5175
WORKDIR /app/FrontEnd
COPY --from=production-dependencies --chown=node:node /app/FrontEnd/node_modules ./node_modules
COPY --from=build --chown=node:node /app/FrontEnd/package.json ./package.json
COPY --from=build --chown=node:node /app/FrontEnd/dist-server ./dist-server
COPY --from=build --chown=node:node /app/FrontEnd/public/data ./public/data
USER node
EXPOSE 5175
CMD ["node", "dist-server/index.js"]

FROM nginx:stable-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/FrontEnd/dist /usr/share/nginx/html
EXPOSE 80
