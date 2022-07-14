import { DeviceService } from "./services/device.service";
import { Module } from "@nestjs/common";
import { DeviceRunnerService } from "./services/devicerunner.service";
import { ConfigModule } from "@nestjs/config";
@Module({
    imports: [ConfigModule.forRoot()],
    controllers: [],
    providers: [
        {
            provide: DeviceService,
            useFactory: () => {
                return new DeviceService();
            },
        },
        {
            provide: DeviceRunnerService,
            useFactory: (deviceService: DeviceService) => {
                return new DeviceRunnerService(deviceService);
            },
            inject: [DeviceService],
        },
    ],
    exports: [DeviceService, DeviceRunnerService],
})
export class DeviceClientModule {}
