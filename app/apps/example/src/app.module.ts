import { HealthCheckService, TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./controllers/health.controller";
import { Module } from "@nestjs/common";
import { AppController } from "./controllers/app.controller";
import { DeviceRunnerService } from "../../../libs/device-client/src/services/devicerunner.service";
import { ConfigModule } from "@nestjs/config";
import { DeviceClientModule, DeviceService } from "@corvina/device-client";
import { DeviceHealthIndicator } from "../../../libs/device-client/src/services/device.health";
import { Config } from "./controllers/device/config.controller";
import { Dice } from "./controllers/device/dice.controller";
import { Sine } from "./controllers/device/sine.controller";
import { Json } from "./controllers/device/json.controller";

// TODO: device factory
@Module({
    imports: [TerminusModule, ConfigModule.forRoot(), DeviceClientModule],
    controllers: [Config, Dice, Sine, Json, HealthController],
    exports: [],
})
export class AppModule {}
