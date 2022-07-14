// First of all load .env
import { ConfigModule } from "@nestjs/config";

import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./controllers/health.controller";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { DeviceClientModule } from "@corvina/device-client/device.module";
import { DeviceHealthIndicator } from "./services/device.health";
import { Config } from "./controllers/device/config.controller";
import { Dice } from "./controllers/device/dice.controller";
import { Sine } from "./controllers/device/sine.controller";
import { Json } from "./controllers/device/json.controller";

// TODO: device factory
@Module({
    imports: [
        TerminusModule,
        ConfigModule.forRoot(),
        LoggerModule.forRoot({
            pinoHttp: {
                name: process.env.LOG_CONTEXT || process.env.APP_ID,
                level: process.env.LOG_LEVEL || "info",
            },
        }),
        DeviceClientModule,
    ],
    controllers: [Config, Dice, Sine, Json, HealthController],
    providers: [DeviceHealthIndicator],
    exports: [],
})
export class AppModule {}
