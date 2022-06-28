
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DeviceClientModule } from "@corvina/device-client";
// TODO: device factory
@Module({
    imports: [DeviceClientModule, ConfigModule.forRoot()],
    controllers: [],
    providers: [],
})
export class AppModule {}
