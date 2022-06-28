import { Logger, Controller, Injectable, Post, Query, Inject } from "@nestjs/common";
import { DeviceService } from "../../../../../libs/device-client/src/services/device.service";
import { DataPoint } from "../../../../../libs/device-client/src/common/types";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { DataPointDTO } from "./dto/datapoint.dto";

/** Handles requests from Nebbiolo FOG CEP */
@ApiTags("device")
@Controller("/device/dice")
@Injectable()
export class Dice {
    private readonly l = new Logger(Dice.name);
    @Inject() private readonly deviceService: DeviceService;

    @ApiOperation({
        summary: "Post binary (0/1) values sampled from a uniform random number distribution",
    })
    @ApiQuery({
        name: "tagName",
        description: "device identifier (name) of data source",
        schema: { default: "Tag" },
        required: false,
    })
    @Post()
    async post(@Query("tagName") tagName: string): Promise<DataPointDTO[]> {
        const t = Date.now();
        const v = Math.random() > 0.5;
        const dataPoints = new Array<DataPoint>();
        const dp: DataPoint = {
            tagName,
            value: v,
            timestamp: t,
        };
        dataPoints.push(dp);
        await this.deviceService.post(dataPoints);
        return dataPoints;
    }
}
