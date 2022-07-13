import { DeviceService } from "./services/device.service";
import { Module, Logger } from "@nestjs/common";
import { DeviceRunnerService } from "./services/devicerunner.service";
import { ConfigModule } from "@nestjs/config";
import { setLogger } from "./services/logger.service";

@Module({
    imports: [ConfigModule.forRoot()],
    controllers: [],
    providers: [
        {
            provide: DeviceService,
            useFactory: () => {
                // use the default nestjs logger
                setLogger(Logger);
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
