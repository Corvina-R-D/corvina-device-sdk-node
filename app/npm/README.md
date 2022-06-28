<h1 align="center"></h1>

<h3 align="center">Corvina Device SDK</h3>


### Installation

#### Usage in a [Nestjs](https://nestjs.com) application

In your app module, import the device client module:

```ts
import { DeviceClientModule } from '@corvina/corvina-device-sdk';

@Module({
  imports: [DeviceClientModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

In your `main.ts` you can start the device using the `DeviceRunner` service.
This service reads the configuration from a `.env` file.

```ts
import { DeviceRunnerService } from '@corvina/corvina-device-sdk';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);

  app.get(DeviceRunnerService).run();
}
```


#### Using in a plain nodejs application

Install `@nestjs/common` peer dependency and `dotenv` to load `.env` into `process.env`:

```
yarn install @nestjs/common dotenv
```

Run the device using the given runner:

```ts
import 'dotenv/config'
import { DeviceRunnerService, DeviceService } from '@corvina/corvina-device-sdk';

const devRunner = new DeviceRunnerService(new DeviceService());

devRunner.run();
```


## Change Log

See [Changelog](CHANGELOG.md) for more information.

## Contributing

Contributions welcome! See [Contributing](CONTRIBUTING.md).

## Author

**Arrigo Zanette**

## License

Licensed under the MIT License - see the [LICENSE](LICENSE) file for details.