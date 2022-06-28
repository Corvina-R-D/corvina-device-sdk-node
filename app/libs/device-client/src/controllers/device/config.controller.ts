import { Logger, Controller, Injectable, Body, Post, Get, Inject } from "@nestjs/common";
import _ from "lodash";
import { DeviceConfig, DeviceService } from "../../services/device.service";
import { DataPoint } from "../../common/types";
import { Request, Response } from "express";
import { LicenseData } from "../../services/licensesaxiosinstance";
import { ApiTags } from "@nestjs/swagger";
import { AlarmDescDTO, DeviceConfigDTO, TagDescDTO } from "./dto/deviceconfig.dto";
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
        const inputConfig = _.omit(newConfig, ["availableTags", "availableAlarms"]);
        const availableAlarmsMap = new Map<string, AlarmDescDTO>();
        const availableTagsMap = new Map<string, TagDescDTO>();
        inputConfig.availableAlarmsMap.forEach((v: AlarmDescDTO) => availableAlarmsMap.set(v.name, v));
        inputConfig.availableTagsMap.forEach((v: TagDescDTO) => availableTagsMap.set(v.name, v));
        this.deviceService.reinit(inputConfig);
        const outputConfig = this.deviceService.getDeviceConfig();
        const resultDto = _.omit(newConfig, ["availableTags", "availableAlarms"]);
        resultDto.availableTags = outputConfig.availableTags.values();
        resultDto.availableAlarms = outputConfig.availableAlarms.values();
        return resultDto;
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
