import DeviceService, { DataPoint } from '../../services/device.service';
import { Request, Response } from 'express';

/** Handles requests from Nebbiolo FOG CEP */
export class Controller {

    /** 
     * Random boolean
     * @route POST /dice 
     * @param {string} n.query.required - name of tag to be used
     * @returns {object} 200 - An array of DataPoint
     * @returns {Error}  default - Unexpected error
     */
    post(req: Request, res: Response, next): void {
        const t = Date.now();
        const v = Math.random() > 0.5;
        const name = req.param("n", "tag")
        let dataPoints = new Array<DataPoint>();
        const dp: DataPoint = {
            tagName: name,
            value: v,
            timestamp: t
        };
        dataPoints.push(dp)
        DeviceService.post(dataPoints).then((r) => {
            res
                .status(200)
                .json(dataPoints)
        }
        ).catch((err) => {
            next(err)
        })
    }
}
export default new Controller();
