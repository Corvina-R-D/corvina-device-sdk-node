FROM eu.gcr.io/corvina-exorint/corvina-base-node18:v2 as builder

WORKDIR /app
ADD ./app/package.json .
ADD ./app/yarn.lock .

RUN yarn install

ADD ./app/ .
RUN find -iname .env -exec rm {} \;
RUN cd ./apps/example && yarn install && yarn build

# Note: it is important to keep Debian versions in sync, or incompatibilities between libcrypto will happen
FROM eu.gcr.io/corvina-exorint/corvina-base-node18:v2

# Set the locale
ENV LANG C.UTF-8

WORKDIR /app
COPY --from=builder /app/ ./

CMD ["node", "/app/apps/example/dist/main.js"]
