import { DefaultEnvDeviceService } from "./defaultenvdevice.service";
import { Injectable } from "@nestjs/common";
import {
    HealthIndicatorResult,
    HealthIndicator,
    HealthCheckError,
} from "@nestjs/terminus";

@Injectable()
export class DefaultEnvDeviceHealthIndicator extends HealthIndicator {
    constructor(private readonly deviceService: DefaultEnvDeviceService) {
        super();
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        const isHealthy = this.deviceService.status.ready == true;
        const result = this.getStatus(
            key,
            isHealthy,
            this.deviceService.status,
        );

        if (this.deviceService.isReady) {
            return result;
        }
        throw new HealthCheckError("Device not ready", result);
    }
}
