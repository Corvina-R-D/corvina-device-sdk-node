import { DeviceService } from ".//services/device.service";
import { Module } from "@nestjs/common";
import CorvinaDataInterface from "./services/corvinadatainterface";

@Module({
    controllers: [],
    providers: [DeviceService, CorvinaDataInterface],
    exports: [DeviceService, CorvinaDataInterface],
})
export class DeviceClientModule {}
