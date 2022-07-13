import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./controllers/health.controller";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DeviceClientModule } from "@corvina/corvina-device-sdk/device.module";
import { DeviceHealthIndicator } from "./services/device.health";
import { Config } from "./controllers/device/config.controller";
import { Dice } from "./controllers/device/dice.controller";
import { Sine } from "./controllers/device/sine.controller";
import { Json } from "./controllers/device/json.controller";

// TODO: device factory
@Module({
    imports: [TerminusModule, ConfigModule.forRoot(), DeviceClientModule],
    controllers: [Config, Dice, Sine, Json, HealthController],
    providers: [DeviceHealthIndicator],
    exports: [],
})
export class AppModule {}
