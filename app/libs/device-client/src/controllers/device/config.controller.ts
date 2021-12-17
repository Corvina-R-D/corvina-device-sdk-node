import {
    Logger,
    Controller,
    Injectable,
    Body,
    Post,
    Get,
    Inject,
} from "@nestjs/common";
import { DeviceConfig, DeviceService } from "../../services/device.service";
import { DataPoint } from "../../common/types"
import { Request, Response } from "express";
import { LicenseData } from "../../services/licensesaxiosinstance";
import { ApiTags } from "@nestjs/swagger";
import { DeviceConfigDTO } from "./dto/deviceconfig.dto";
import { LicenseDataDTO } from "./dto/licensedata.dto";

/** Handles reconfiguration requests */
@ApiTags("device")
@Controller("/device")
@Injectable()
export class Config {
    private readonly l = new Logger(Config.name);
    //@Inject() private readonly deviceService: DeviceService;
    constructor(private readonly deviceService: DeviceService) {}

    /**
     * Apply a new configuration
     */
    @Post("/config")
    config(@Body("newConfig") newConfig: DeviceConfigDTO): DeviceConfigDTO {
        this.l.log("apply new config");
        this.deviceService.reinit(newConfig);
        return this.deviceService.getDeviceConfig();
    }

    /**
     * Get current configuration
     */
    @Get("/config")
    get(): DeviceConfig {
        const config = this.deviceService.getAppliedConfig();
        return config;
    }

    /**
     * Get license data
     */
    @Get("/licenseData")
    getLicenseData(): LicenseDataDTO {
        return this.deviceService.getLicenseData();
    }
}
