FROM node:9.11.2-stretch as builder

WORKDIR /app
ADD ./app .

RUN yarn install
RUN yarn compile

# Note: it is important to keep Debian versions in sync, or incompatibilities between libcrypto will happen
FROM node:9.11.2-stretch

# Set the locale
ENV LANG C.UTF-8

WORKDIR /app
COPY --from=builder /app/ ./

CMD ["node", "/app/dist/index.js"]

