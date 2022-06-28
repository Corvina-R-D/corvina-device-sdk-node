import { Logger, Controller, Injectable, Body, Post, Get } from "@nestjs/common";
import { DeviceConfig, DeviceService } from "../../../../../libs/device-client/src/services/device.service";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
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

    @ApiOperation({
        summary: "Applied a new device configuration",
    })
    @Post("/config")
    config(@Body("newConfig") newConfig: DeviceConfigDTO): DeviceConfigDTO {
        this.l.log("apply new config");
        //this.deviceService.reinit(newConfig);
        return new DeviceConfigDTO(this.deviceService.getDeviceConfig());
    }

    @ApiOperation({
        summary: "Get current applied device configuration",
    })
    @Get("/config")
    get(): DeviceConfig {
        const config = this.deviceService.getAppliedConfig();
        return config;
    }

    @ApiOperation({
        summary: "Get current device license data",
    })
    @Get("/licenseData")
    getLicenseData(): LicenseDataDTO {
        return this.deviceService.getLicenseData();
    }
}
