import { Controller } from "@nestjs/common";
import { DeviceRunnerService } from "@corvina/device-client";

@Controller()
export class AppController {
    constructor(private readonly appService: DeviceRunnerService) {}
}
