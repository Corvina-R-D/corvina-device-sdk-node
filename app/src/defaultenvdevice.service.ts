import { Injectable } from "@nestjs/common";
import {
    DeviceService,
    DeviceConfig,
    PacketFormatEnum,
} from "@corvina/device-client";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";

export interface Status {
    msgSent: number;
    bytesSent: number;
    inited: boolean;
    connected: boolean;
    ready: boolean;
}

@Injectable()
export class DefaultEnvDeviceService {
    private deviceConfig: DeviceConfig;

    get isReady(): boolean {
        return this.deviceService.isReady();
    }

    get status(): Status {
        return {
            msgSent: this.deviceService.getMsgSent(),
            bytesSent: this.deviceService.getBytesSent(),
            ready: this.deviceService.isReady(),
            connected: this.deviceService.isConnected(),
            inited: this.deviceService.isInited(),
        }
    }

    constructor(
        private deviceService: DeviceService,
        private configService: ConfigService,
    ) {
        this.deviceService.setCycleTime(
            configService.get<number>("CYCLE_TIME") || 1000,
        );
        const availableTagsFile = process.env.AVAILABLE_TAGS_FILE || "";
        this.deviceConfig = this.deviceService.reinit(
            {
                activationKey: process.env.ACTIVATION_KEY,
                pairingEndpoint: process.env.PAIRING_ENDPOINT,
                availableTagsFile: availableTagsFile,
                availableTags: (() => {
                    try {
                        if (availableTagsFile.length) {
                            return JSON.parse(
                                fs.readFileSync(availableTagsFile).toString(),
                            );
                        }
                        return JSON.parse(process.env.AVAILABLE_TAGS);
                    } catch (err) {
                        return [];
                    }
                })(),
                simulateTags: !!(() => {
                    try {
                        return JSON.parse(process.env.SIMULATE_TAGS);
                    } catch (err) {
                        return false;
                    }
                })(),
                availableAlarms: (() => {
                    try {
                        return JSON.parse(process.env.AVAILABLE_ALARMS);
                    } catch (err) {
                        return [];
                    }
                })(),
                simulateAlarms: !!(() => {
                    try {
                        return JSON.parse(process.env.SIMULATE_ALARMS);
                    } catch (err) {
                        return false;
                    }
                })(),
                packetFormat:
                    (process.env.PACKET_FORMAT as PacketFormatEnum) ||
                    PacketFormatEnum.BSON,
            },
            true,
        );

        // save data to file
        const envFile = path.join(process.cwd(), ".env");
        let currentContent = fs.readFileSync(envFile).toString();
        const appendedValuesPos = currentContent.indexOf("### LAST-ENV ###");
        if (appendedValuesPos > 0) {
            currentContent = currentContent.slice(0, appendedValuesPos);
            currentContent += `
### LAST-ENV ###
# don't write below this line!!
ACTIVATION_KEY=${this.deviceConfig.activationKey}
PAIRING_ENDPOINT=${this.deviceConfig.pairingEndpoint}
AVAILABLE_TAGS_FILE=${this.deviceConfig.availableTagsFile || ""}
AVAILABLE_TAGS=${
                !this.deviceConfig.availableTagsFile ||
                this.deviceConfig.availableTagsFile.length == 0
                    ? JSON.stringify(this.deviceConfig.availableTags)
                    : ""
            }
SIMULATE_TAGS=${this.deviceConfig.simulateTags ? 1 : 0}
AVAILABLE_ALARMS=${JSON.stringify(this.deviceConfig.availableAlarms)}
SIMULATE_ALARMS=${this.deviceConfig.simulateAlarms ? 1 : 0}
PACKET_FORMAT=${this.deviceConfig.packetFormat}`;
        }
        fs.writeFileSync(envFile, currentContent);
    }

    getHello(): string {
        return "Hello World!";
    }
}
