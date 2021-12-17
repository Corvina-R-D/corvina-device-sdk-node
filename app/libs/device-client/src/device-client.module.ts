import { Sine } from "./controllers/device/sine.controller";
import { Dice } from "./controllers/device/dice.controller";
import { Config } from "./controllers/device/config.controller";
import { DeviceService } from ".//services/device.service";
import { Module } from "@nestjs/common";
import CorvinaDataInterface from "./services/corvinadatainterface";

@Module({
    controllers: [Config, Dice, Sine],
    providers: [DeviceService, CorvinaDataInterface],
    exports: [DeviceService, CorvinaDataInterface],
})
export class DeviceClientModule {}
