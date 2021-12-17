import { Controller, Get } from "@nestjs/common";
import { DefaultEnvDeviceService } from "./defaultenvdevice.service";

@Controller()
export class AppController {
    constructor(private readonly appService: DefaultEnvDeviceService) {}

    @Get()
    getHello(): string {
        return this.appService.getHello();
    }
}
