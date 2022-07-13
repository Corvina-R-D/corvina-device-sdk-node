import { Controller } from "@nestjs/common";
import { DeviceRunnerService } from "@corvina/corvina-device-sdk";

@Controller()
export class AppController {
    constructor(private readonly appService: DeviceRunnerService) {}
}
