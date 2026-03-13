FROM node:22-alpine AS builder

WORKDIR /app
COPY app/package.json app/yarn.lock ./
COPY app/.yarnrc.yml ./
COPY app/.yarn .yarn

RUN yarn install

COPY app/ ./
RUN find -iname .env -exec rm {} \;
RUN cd ./apps/example && yarn workspaces focus && yarn build


FROM node:22-alpine

# Set the locale
ENV LANG=C.UTF-8

WORKDIR /app
COPY --from=builder /app ./

CMD ["node", "apps/example/dist/main.js"]
