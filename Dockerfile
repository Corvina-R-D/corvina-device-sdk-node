FROM eu.gcr.io/corvina-exorint/corvina-base-node10:v1 as builder

WORKDIR /app
ADD ./app .

RUN yarn install
RUN yarn compile

# Note: it is important to keep Debian versions in sync, or incompatibilities between libcrypto will happen
FROM eu.gcr.io/corvina-exorint/corvina-base-node10:v1 

# Set the locale
ENV LANG C.UTF-8

WORKDIR /app
COPY --from=builder /app/ ./

CMD ["node", "/app/dist/index.js"]
#CMD ["yarn", "run", "dev"]
