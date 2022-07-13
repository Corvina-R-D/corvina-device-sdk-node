import { Logger, Controller, Injectable, Post, Query, Inject, Body, Param } from "@nestjs/common";
import { DeviceService } from "@corvina/corvina-device-sdk";
import { DataPoint } from "@corvina/corvina-device-sdk";
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { DataPointDTO } from "./dto/datapoint.dto";

/** Handles requests from Nebbiolo FOG CEP */
@ApiTags("device")
@Controller("/device/json/")
@Injectable()
export class Json {
    private readonly l = new Logger(Json.name);
    @Inject() private readonly deviceService: DeviceService;

    @ApiOperation({
        summary: "Post a new JSON value",
    })
    @ApiQuery({
        name: "tagName",
        description: "prefix of device identifier (name) of data source. The actual tag names advertised to the cloud are automatically generated as this prefix plus each property JSON path. The prefix can be undefined, so that only JSON paths are used",
        schema: { default: undefined },
        required: false,
    })
    @ApiQuery({
        name: "timestamp",
        description: "specify a timestamp (if omitted the request timestamp is used) ",
        required: false,
    })
    @ApiBody({
        description:
            "the json value to set. Each property in the json is assigned as internal identifier (tagName) the corresponding the json path. For instance { v: {a : 1 } } corresponds to advertised available tags: ['v.a'] ",
        schema: { default: "{}" },
    })
    @Post()
    async post(
        @Query("tagName") tagName = undefined,
        @Query("timestamp") timestamp = undefined,
        @Body() v: any,
    ): Promise<DataPointDTO[]> {
        const t = timestamp || Date.now();
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
