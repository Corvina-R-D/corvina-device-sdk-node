import { Logger, Controller, Injectable, Post, Query, Inject, Body, Param } from "@nestjs/common";
import { DeviceService } from "@corvina/device-client";
import { DataPoint } from "@corvina/device-client";
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { DataPointDTO } from "./dto/datapoint.dto";
import axios from "axios";

@ApiTags("device")
@Controller("/device/json/")
@Injectable()
export class Json {
    private readonly l = new Logger(Json.name);
    @Inject() private readonly deviceService: DeviceService;

    @ApiOperation({
        summary: "Post a new JSON value",
        callbacks: {
            result: {
                "{$request.query#/callback}": {
                    post: {
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            error: {
                                                type: "object",
                                                properties: {
                                                    message: {
                                                        type: "string",
                                                    },
                                                },
                                            },
                                            tagName: {
                                                type: "string",
                                            },
                                            modelPath: {
                                                type: "string",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        responses: {
                            "200": { description: "The server acknowledged the request" },
                        },
                    },
                },
            },
        },
    })
    @ApiQuery({
        name: "tagName",
        description:
            "Prefix of device identifier (name) of data source. The actual tag names advertised to the cloud are automatically generated as this prefix plus each property JSON path. The prefix can be undefined, so that only JSON paths are used",
        schema: { default: undefined, example: "temperature" },
        required: false,
    })
    @ApiQuery({
        name: "timestamp",
        description: "Specify a timestamp (if omitted the request timestamp is used) ",
        required: false,
    })
    @ApiQuery({
        name: "callback",
        description: "Specify an optional callback to be invoked when the message has been delivered",
        schema: { type: "string", format: "uri", example: "http://localhost:30001" },
        required: false,
    })
    @ApiQuery({
        name: "qos",
        description: "Specify an optional qos (by default is zeo)",
        schema: { type: "number", minimum: 0, maximum: 2, default: 0, example: 1 },
        required: false,
    })
    @ApiBody({
        description:
            "The json value to set. Each property in the json is assigned as full tag name advertised to the cloud as ```availableTags``` the corresponding json path prefixed by ```tagName```. For instance, if ```tagName=\"tag\"``` and value is ```{ a: {b : 1 } }``` the advertised list of available tags is  ```['tag.a.b']```. If ```tagName``` is undefined the advertised list of available tags is simply ```['a.b']```",
        schema: { default: "{}", example: { Tag1: 1 } },
    })
    @Post()
    async post(
        @Query("tagName") tagName = undefined,
        @Query("timestamp") timestamp = undefined,
        @Query("qos") qos = undefined,
        @Query("callback") postCallback = undefined,
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
        await this.deviceService.post(dataPoints, {
            qos: qos || 0,
            cb: postCallback
                ? (error, tagName, modelPath) => {
                      axios.post(postCallback, { error: { message: error.message }, tagName, modelPath });
                  }
                : undefined,
        });
        return dataPoints;
    }
}
