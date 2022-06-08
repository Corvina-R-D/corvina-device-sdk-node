import { Controller, Get } from "@nestjs/common";
import { DeviceHealthIndicator } from "../../../../libs/device-client/src/services/device.health";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";

@Controller("health")
export class HealthController {
    constructor(private health: HealthCheckService, private deviceHealthIndicator: DeviceHealthIndicator) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([async () => this.deviceHealthIndicator.isHealthy("device")]);
    }
}
