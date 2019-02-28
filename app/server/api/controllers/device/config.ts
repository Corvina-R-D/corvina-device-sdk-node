import DeviceService, { DataPoint, DeviceConfig } from '../../services/device.service';
import { Request, Response } from 'express';

/** Handles reconfiguration requests */
export class Controller {

    /** 
     * Random boolean
     * @route POST /dice 
     * @param {string} config.query.required - configuration settings (same as env vars) { activationKey:  .., pairingEndpoint: ...,  availableTags: ... , simulateTags: true ... }
     * @returns {object} 200 - An array of DataPoint
     * @returns {Error}  default - Unexpected error
     */
    post(req: Request, res: Response, next): void {
        const newConfig = req.body.config as DeviceConfig;
        console.log("apply new config")
        try {
            DeviceService.reinit(newConfig)
            res.status(200)
                .json(DeviceService.getDeviceConfig())
        } catch (err) {
            next(err)
        }
    }

    get(req: Request, res: Response, next): void {
        try {
        res.status(200)
                .json(DeviceService.getAppliedConfig())
        } catch (err) {
            next(err)
        }
    }

    getLicenseData(req: Request, res: Response, next): void {
        try {
        res.status(200)
                .json(DeviceService.getLicenseData())
        } catch (err) {
            next(err)
        }
    }
}

export default new Controller();
