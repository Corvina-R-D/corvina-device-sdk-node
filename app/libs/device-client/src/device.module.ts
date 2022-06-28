import { DeviceService } from "./services/device.service";
import { Module } from "@nestjs/common";
import { DeviceRunnerService } from "./services/devicerunner.service";
import { ConfigModule } from "@nestjs/config";

@Module({
    imports: [ConfigModule.forRoot()],
    controllers: [],
    providers: [DeviceService, DeviceRunnerService],
    exports: [DeviceService, DeviceRunnerService],
})
export class DeviceClientModule {}
