<h1 align="center">Corvina Device SDK</h1>

## Installation

Install the dependency:

```shell
yarn install @corvina/device-client
```

Run the device using the given runner:

```ts
import dotenv from "dotenv"
dotenv.config()

import { DeviceRunnerService, DeviceService } from '@corvina/device-client';

const devRunner = new DeviceRunnerService(new DeviceService());

devRunner.run();
```

The `DeviceRunnerService` is responsible for translating the environment configuration to the JSON configuration to be used to init the class `DeviceService`.

### Usage in a [Nestjs](https://nestjs.com) application

In your app module, import the device client module:

```ts
import { DeviceClientModule } from '@corvina/device-client/device.module';

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
import { DeviceRunnerService } from '@corvina/device-client';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);

  app.get(DeviceRunnerService).run();
}
```

### Sending data

> The actual sending occurs according to the configuration received from the cloud. Posting a tag not configured from the cloud will result in an error.

In order to send data the `DeviceClient` class exposes the `post` method.
The method allow to post a list of data points.

A data point is defined by:
* a `tagName`, representing the device identifier of the data point
* a `timestamp`, representing the UTC timestamp the value was originate
* a `value`

The `post` method accepts further options:
* `qos`, the MQTT QoS required
* `cb`, a function callback to catch sending errors or confirmations 
* `forceImmediateSend`, to bypass the publish policies configured from the cloud and just send the data immediately
* `recurseNotifyOnlyWholeObject`, when posting a full JSON, just post the full object not every single path

#### Simulation

The device can be set up using environment variables to simulate data sending.

1. set the available tags to simulate (the list will also be published to the cloud):
  
  ```
    AVAILABLE_TAGS=[{"name":"Tag1","type":"integer"},{"name":"Tag2","type":"integer"},{"name":"Tag3","type":"integer"},{"name":"PositionNow","type":"integer"},{"name":"InputTag","type":"integer"}]
  ```
2. enable simulation:
  ```
    SIMULATE_TAGS=1
  ```

The same can be done for alarms:

1. set up the alarms to simulate:

```
  AVAILABLE_ALARMS=[{"name":"Alarm10","severity":1,"source":"Tag1","desc":{"en":"Tag above normal : [Tag1]"},"ack_required":true,"reset_required":true,"simulation":{"f":"{ return Math.random() > 0.5 }"}}]
```
2. enable simulation:
  ```
    SIMULATE_ALARMS=1
  ```


### Receiving data


> In order to receive data on a tag the tag must be configured writable in the cloud mapping 

When data is written from the cloud a `write` event is emitted and can be used to handle the write request.

The event will report an object containing:
*  `modelPath`: the written model path
* `v`: the written value

For example:

```
    app.get(DeviceService).on("write", (event) => {
        console.log("Write event received", event);
    });
```

#### Manual simulation

If tag simulation is enabled, and the tag simulation type is `const`, the write operation will overwrite the simulated const value.

In this way is possible to manually trigger simulated alarms having that tag as source tag:

```
AVAILABLE_ALARMS=[{"name":"Threshold","severity":1,"source":"Tag1","desc":{"en":"Tag above normal : [Tag1]"},"ack_required":false,"reset_required":false,"simulation":{"f":"{ return $('Tag1') > 10 }"}}]
```

## Environment variables

See [envs.md](envs.md) for a detailed description of environment variables.

<!-- ## Change Log

See [Changelog](CHANGELOG.md) for more information.

## Contributing

Contributions welcome! See [Contributing](CONTRIBUTING.md). -->

## Author

**Arrigo Zanette**

## License

Licensed under the MIT License - see the [LICENSE](LICENSE) file for details.