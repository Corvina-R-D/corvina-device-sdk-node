import { DeviceHealthIndicator } from "./services/device.health";
import { Sine } from "../../../apps/example/src/controllers/device/sine.controller";
import { Dice } from "../../../apps/example/src/controllers/device/dice.controller";
import { Config } from "../../../apps/example/src/controllers/device/config.controller";
import { Json } from "../../../apps/example/src/controllers/device/json.controller";
import { DeviceService } from "./services/device.service";
import { Module } from "@nestjs/common";
import CorvinaDataInterface from "./services/corvinadatainterface";
import { DeviceRunnerService } from "./services/devicerunner.service";
import { ConfigModule } from "@nestjs/config";

@Module({
    imports: [ConfigModule.forRoot()],
    controllers: [],
    providers: [DeviceService, DeviceRunnerService, DeviceHealthIndicator],
    exports: [DeviceService, DeviceRunnerService, DeviceHealthIndicator],
})
export class DeviceClientModule {}
