import { Controller } from "@nestjs/common";
import { DeviceRunnerService } from "../../../../libs/device-client/src/services/devicerunner.service";

@Controller()
export class AppController {
    constructor(private readonly appService: DeviceRunnerService) {}
}
