import DeviceService from '../../services/device.service';
import { DataPoint } from '../../services/commontypes';
import { Request, Response } from 'express';

export class Controller {

    /** 
     * Generates sin wave
     * @route POST /sine 
     * @param {string} n.query.required - name of tag to be used
     * @param {number} [t.query=1000] - period in ms of sine wave
     * @param {number} [a.query=100] - amplitude of sine wave
     * @param {number} [p.query=0] - phase (rad)
     * @returns {object} 200 - An array of DataPoint
     * @returns {Error}  default - Unexpected error
     */
    post(req: Request, res: Response, next): void {
        const name = req.param("n", "Tag");
        const period = parseFloat(req.param("t", 1000));
        const amplitude = parseFloat(req.param("a", 100));
        const phase = parseFloat(req.param("p", 0));
        const t = Date.now();
        const v = amplitude * Math.sin(phase + Date.now() / period * 2 * Math.PI);
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
