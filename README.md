# Corvina simulated device

```bash
docker build -t corvina-node-device .
docker run --rm -e ACTIVATION_KEY=activation_key -ti corvina-node-device
```

Alternatively, a `.env` file containing the environment variable definitions can be mounted to the container:

```bash
docker run --rm -v $(pwd)/.env:/app/.env -ti corvina-node-device
```

See app/README.md for more details about available environment variables options
