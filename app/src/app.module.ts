import { HealthCheckService, TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DefaultEnvDeviceService } from "./defaultenvdevice.service";
import { ConfigModule } from "@nestjs/config";
import { DeviceClientModule } from "@corvina/device-client";
import { DefaultEnvDeviceHealthIndicator } from "./defaultenvdevice.health";

// TODO: device factory
@Module({
    imports: [TerminusModule, DeviceClientModule, ConfigModule.forRoot()],
    controllers: [AppController, HealthController],
    providers: [DefaultEnvDeviceService, DefaultEnvDeviceHealthIndicator],
})
export class AppModule {}
