FROM node:8.11.1-stretch as builder

WORKDIR /app
ADD . .

RUN npm install
RUN npm run build

# Note: it is important to keep Debian versions in sync, or incompatibilities between libcrypto will happen
FROM node:8.11.1-stretch

# Set the locale
ENV LANG C.UTF-8

WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/config ./config
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/tslint.json ./
COPY --from=builder /app/tsconfig.json ./

ADD ./elastic_mappings ./elastic_mappings

CMD ["npm", "start"]

