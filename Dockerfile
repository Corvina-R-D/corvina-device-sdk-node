FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (cached unless manifests or lockfile change)
COPY app/package.json app/yarn.lock app/.yarnrc.yml ./
COPY app/.yarn .yarn
COPY app/apps/example/package.json apps/example/
COPY app/libs/device-client/package.json libs/device-client/
RUN yarn workspaces focus @corvina/device-example

COPY app/ ./
RUN find -iname .env -exec rm {} \;
# Build (tsc -b also builds device-client through project references), then prune devDependencies
RUN yarn workspace @corvina/device-example build \
 && yarn workspaces focus --production @corvina/device-example


FROM node:22-alpine

RUN apk add openssl ca-certificates tini

# Set the locale
ENV LANG=C.UTF-8

WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/example/package.json apps/example/
COPY --from=builder /app/apps/example/dist apps/example/dist
# node_modules/@corvina/device-client links to the workspace
COPY --from=builder /app/libs/device-client/package.json libs/device-client/
COPY --from=builder /app/libs/device-client/dist libs/device-client/dist

# Run unprivileged: app files stay root-owned (read-only), /app/data is writable (e.g. MQTT_MSG_STORE_PATH=/app/data/mqtt)
RUN mkdir data && chown node:node data
USER node

# tini forwards signals and reaps zombies; -s (subreaper) keeps it working also when not PID 1 (e.g. docker run --init)
ENTRYPOINT ["/sbin/tini", "-s", "--"]
CMD ["node", "apps/example/dist/main.js"]
