import { Injectable } from "@nestjs/common";
import { DeviceService } from "./device.service";
import { PacketFormatEnum } from "../common/types";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { AlarmDesc, TagDesc } from "../common/types";
import { DeviceRunner } from "./devicerunner.interface";

@Injectable()
export class DeviceRunnerService implements DeviceRunner {
    private setAvailableStructures(availableTags: TagDesc[]): Map<string, TagDesc> {
        const structs = new Set<TagDesc>();
        availableTags.forEach((tag) => {
            const pos = tag.name.indexOf(".");
            if (pos >= 0) {
                structs.add({ name: tag.name.slice(0, pos), type: "struct", simulation: null });
            }
        });
        availableTags.push(...structs);
        const result = new Map<string, TagDesc>();
        availableTags.forEach((t) => {
            result.set(t.name, t);
        });
        return result;
    }

    constructor(private configService: ConfigService, private deviceService: DeviceService) {}

    run() {
        this.deviceService.setCycleTime(this.configService.get<number>("CYCLE_TIME") || 1000);
        const availableTagsFile = process.env.AVAILABLE_TAGS_FILE || "";
        this.deviceService.reinit(
            {
                activationKey: process.env.ACTIVATION_KEY,
                pairingEndpoint: process.env.PAIRING_ENDPOINT,
                availableTagsFile: availableTagsFile,
                availableTags: ((): Map<string, TagDesc> => {
                    try {
                        if (availableTagsFile.length) {
                            return this.setAvailableStructures(
                                JSON.parse(fs.readFileSync(availableTagsFile).toString()),
                            );
                        }
                        return this.setAvailableStructures(JSON.parse(process.env.AVAILABLE_TAGS));
                    } catch (err) {
                        return new Map<string, TagDesc>();
                    }
                })(),
                simulateTags: !!(() => {
                    try {
                        return JSON.parse(process.env.SIMULATE_TAGS);
                    } catch (err) {
                        return false;
                    }
                })(),
                availableAlarms: ((): Map<string, AlarmDesc> => {
                    try {
                        const alarmsMap = new Map<string, AlarmDesc>();
                        JSON.parse(process.env.AVAILABLE_ALARMS).forEach((a) => {
                            alarmsMap.set(a.name, a);
                        });
                        return alarmsMap;
                    } catch (err) {
                        return new Map<string, AlarmDesc>();
                    }
                })(),
                simulateAlarms: !!(() => {
                    try {
                        return JSON.parse(process.env.SIMULATE_ALARMS);
                    } catch (err) {
                        return false;
                    }
                })(),
                packetFormat: (process.env.PACKET_FORMAT as PacketFormatEnum) || PacketFormatEnum.BSON,
            },
            true,
        );

        // save data to file
        const envFile = path.join(process.cwd(), ".env");
        let currentContent = fs.readFileSync(envFile).toString();
        const appendedValuesPos = currentContent.indexOf("### LAST-ENV ###");
        const deviceConfig = this.deviceService.deviceConfig;
        if (appendedValuesPos > 0) {
            currentContent = currentContent.slice(0, appendedValuesPos);
            currentContent += `
### LAST-ENV ###
# don't write below this line!!
ACTIVATION_KEY=${deviceConfig.activationKey}
PAIRING_ENDPOINT=${deviceConfig.pairingEndpoint}
AVAILABLE_TAGS_FILE=${deviceConfig.availableTagsFile || ""}
AVAILABLE_TAGS=${
                !deviceConfig.availableTagsFile || deviceConfig.availableTagsFile.length == 0
                    ? JSON.stringify(Array.from(deviceConfig.availableTags.values()))
                    : ""
            }
SIMULATE_TAGS=${deviceConfig.simulateTags ? 1 : 0}
AVAILABLE_ALARMS=${JSON.stringify(Array.from(deviceConfig.availableAlarms.values()))}
SIMULATE_ALARMS=${deviceConfig.simulateAlarms ? 1 : 0}
PACKET_FORMAT=${deviceConfig.packetFormat}`;
        }
        fs.writeFileSync(envFile, currentContent);
    }
}
