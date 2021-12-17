import {
    Logger,
    Controller,
    Injectable,
    Post,
    Query,
    Inject,
} from "@nestjs/common";
import { DeviceService } from "../services/device.service";
import { DataPoint } from "../common/types";
import { ApiTags } from "@nestjs/swagger";
import { DataPointDTO } from "./device/dto/datapoint.dto";

/** Handles requests from Nebbiolo FOG CEP */
@ApiTags("device")
@Controller("/device/json")
@Injectable()
export class Sine {
    private readonly l = new Logger(Sine.name);
    @Inject() private readonly deviceService: DeviceService;

    /**
     * Post JSON data
     * @route POST /sine
     * @param {string} n.query.required - name of tag to be used
     * @param {number} [t.query=1000] - period in ms of sine wave
     * @param {number} [a.query=100] - amplitude of sine wave
     * @param {number} [p.query=0] - phase (rad)
     * @returns {object} 200 - An array of DataPoint
     * @returns {Error}  default - Unexpected error
     */
    @Post()
    async post(
        @Query("n") tagName = "Tag",
        @Query("t") period = 1000,
        @Query("a") amplitude = 1000,
        @Query("p") phase = 0,
    ): Promise<DataPointDTO[]> {
        const t = Date.now();
        const v =
            amplitude * Math.sin(phase + (Date.now() / period) * 2 * Math.PI);
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
