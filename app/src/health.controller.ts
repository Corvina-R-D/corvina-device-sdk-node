import { Controller, Get } from "@nestjs/common";
import { DefaultEnvDeviceHealthIndicator } from "./defaultenvdevice.health";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";

@Controller("health")
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private deviceHealthIndicator: DefaultEnvDeviceHealthIndicator,
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            async () => this.deviceHealthIndicator.isHealthy("device"),
        ]);
    }
}
