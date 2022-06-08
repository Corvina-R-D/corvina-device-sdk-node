import { Injectable } from "@nestjs/common";
import { HealthIndicatorResult, HealthIndicator, HealthCheckError } from "@nestjs/terminus";
import { DeviceService } from "./device.service";

@Injectable()
export class DeviceHealthIndicator extends HealthIndicator {
    constructor(private readonly deviceService: DeviceService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        const isHealthy = this.deviceService.status.ready == true;
        const result = this.getStatus(key, isHealthy, this.deviceService.status);

        if (this.deviceService.isReady) {
            return result;
        }
        throw new HealthCheckError("Device not ready", result);
    }
}
