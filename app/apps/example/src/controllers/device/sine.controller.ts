import { Logger, Controller, Injectable, Post, Query, Inject } from "@nestjs/common";
import { DeviceService } from "@corvina/device-client";
import { DataPoint } from "@corvina/device-client";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { DataPointDTO } from "./dto/datapoint.dto";

/** Handles requests from Nebbiolo FOG CEP */
@ApiTags("device")
@Controller("/device/sine")
@Injectable()
export class Sine {
    private readonly l = new Logger(Sine.name);
    @Inject() private readonly deviceService: DeviceService;

    @ApiOperation({
        summary: "Post a new value sampled from a sine wave with the given parameters, using wall clock as time base",
    })
    @ApiQuery({
        name: "tagName",
        description: "device identifier (name) of data source",
        schema: { default: "Tag" },
        required: false,
    })
    @ApiQuery({
        name: "period",
        description: "period in ms of the sine wave",
        required: false,
        schema: { default: 1000 },
    })
    @ApiQuery({
        name: "amplitude",
        description: "amplitude of the sine wave",
        required: false,
        schema: { default: 1000 },
    })
    @ApiQuery({ name: "phase", description: "phase of the sine wave", required: false, schema: { default: 0 } })
    @Post()
    async post(
        @Query("tagName") tagName = "Tag",
        @Query("period") period = 1000,
        @Query("amplitude") amplitude = 1000,
        @Query("phase") phase = 0,
    ): Promise<DataPointDTO[]> {
        const t = Date.now();
        const v = amplitude * Math.sin(phase + (Date.now() / period) * 2 * Math.PI);
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
