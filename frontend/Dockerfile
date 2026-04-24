FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

FROM base AS dev
EXPOSE 5173
CMD ["pnpm", "run", "dev"]

FROM base AS builder
COPY . .
ARG VITE_SERVER_URL=http://localhost:3001
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN pnpm run build

FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
