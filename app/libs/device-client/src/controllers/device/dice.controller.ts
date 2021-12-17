import {
    Logger,
    Controller,
    Injectable,
    Post,
    Query,
    Inject,
} from "@nestjs/common";
import { DeviceService } from "../../services/device.service";
import { DataPoint } from "../../common/types";
import { Request, Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { DataPointDTO } from "./dto/datapoint.dto";

/** Handles requests from Nebbiolo FOG CEP */
@ApiTags("device")
@Controller("/device/dice")
@Injectable()
export class Dice {
    private readonly l = new Logger(Dice.name);
    @Inject() private readonly deviceService: DeviceService;

    /**
     * Random boolean
     * @route POST /dice
     * @param {string} n.query.required - name of tag to be used
     * @returns {object} 200 - An array of DataPoint
     * @returns {Error}  default - Unexpected error
     */
    @Post()
    async post(@Query("n") tagName: string): Promise<DataPointDTO[]> {
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
