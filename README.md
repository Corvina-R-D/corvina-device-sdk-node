# Corvina simulated device

## Running the example

### Activation key

To get a new license [go to](https://licenses.corvina.fog:10443/) then click on "Generate new license" button, leave any field blank and click "Save" button.
It will show the generated license code, copy and use it as activation key.

```bash
cp -n ./app/.env.example ./app/apps/example/.env
```

Paste the activation key in the `ACTIVATION_KEY` environment variable in file (`./app/apps/example/.env`).

### Running the docker container

```bash
docker build -t corvina-node-device .
```

#### Passing activation key via environment file

A `.env` file containing the environment variable definitions can be mounted to the container:

```bash
docker run --rm -v $(pwd)/.env:/app/.env -ti corvina-node-device
```

#### Passing activation key via command line

```bash
docker run --rm -e ACTIVATION_KEY=<paste-your-activation-key-here> -ti corvina-node-device
```

## Via npx

```bash
npx @corvina/device-example@latest
```

## Miscellaneous

- See [this document](./app/README.md) for more details about available environment variables options;
- See [developer document](./README-dev.md) for more details about development and debugging options;
