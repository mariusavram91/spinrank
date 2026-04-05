FROM node:20-slim AS frontend-base

WORKDIR /app

COPY package*.json ./
COPY scripts ./scripts
RUN SKIP_HOOK=1 npm ci

COPY . .

ENV NODE_ENV=development
ENV SKIP_HOOK=1

FROM frontend-base AS frontend-dev

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM mcr.microsoft.com/playwright:v1.59.1-noble AS frontend-e2e

WORKDIR /app

COPY package*.json ./
COPY scripts ./scripts
RUN SKIP_HOOK=1 npm ci

COPY . .

ENV NODE_ENV=test
ENV SKIP_HOOK=1
