FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

FROM base AS dev
EXPOSE 3001
CMD ["pnpm", "run", "dev"]

FROM base AS builder
COPY . .
RUN pnpm run prepare-words
RUN pnpm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/words ./words
EXPOSE 3001
CMD ["node", "dist/index.js"]
