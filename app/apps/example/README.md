# Corvina device example

This is an example of the usage of `@corvina/device-client`.

The device client can be configured with environment variables (or `.env` file).

In addition, this example exposes a web interface to post arbitrary JSON data or to simulate device data.

## Quick Start

At least the following environment variables must be configured:

```shell
ACTIVATION_KEY=<your_device_activation_key>
PAIRING_ENDPOINT=https://pairing.corvina.io/api/v1/ 
```

The device can be started:

* via package manager:

```shell
npm install @corvina/device-example
```

chande directory to `./app/apps/example` and run:

```shell
npx @corvina/device-example
```

* via `npx` (version >= 8)

```shell
npx @corvina/device-example@latest
```

* from sources:

chande directory to `./app/apps/example` and run:

```shell
yarn install
yarn start:dev
```

A web interface will be available at `http://localhost:3000/swagger-ui`.

## Environment variables

This example device provides the environment variable `WRITE_CALLBACK` to configure a webhook for written data:


In addition, the full list of environment variables used by `@corvina/device-client` can be used.

### Using the example rest interface

It is possible to send generic JSON posting to the `/device/json` endpoint.

Each of the JSON properties posted will be advertised to the cloud with the corresponding JSON paths.
