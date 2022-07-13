import { ApiProperty } from "@nestjs/swagger";
import {
    AlarmDesc,
    MultiLangString,
    NoiseSimulationProperties,
    NoiseSimulationType,
    NullableSimulationProperties,
    NullableSimulationStateMachine,
    SimulationDesc,
    SimulationType,
    PacketFormatEnum,
    TagDesc,
} from "@corvina/corvina-device-sdk";
import { DeviceConfig } from "@corvina/corvina-device-sdk";

export class NullableSimulationStateMachineDTO implements NullableSimulationStateMachine {
    nullifying: boolean;
    start: number;
    duration: number;
}

export class NullableSimulationPropertiesDTO implements NullableSimulationProperties {
    probability: number;
    dt_min: number;
    dt_max: number;
    state?: NullableSimulationStateMachineDTO;
}

export class NoiseSimulationPropertiesDTO implements NoiseSimulationProperties {
    type: NoiseSimulationType;
    amplitude: number;
}

export class SimulationDescDTO implements SimulationDesc {
    type: SimulationType;
    noise: NoiseSimulationPropertiesDTO;
    nullable: NullableSimulationPropertiesDTO;
}

export class TagDescDTO implements TagDesc {
    name: string;
    type: string;
    simulation?: SimulationDescDTO;
}

export class MultiLangStringDTO implements MultiLangString {
    [languageCode: string]: string;
}

export class AlarmDescDTO implements AlarmDesc {
    name: string;
    desc: MultiLangStringDTO;
    source: string;
    severity: number;
    ack_required: boolean;
    reset_required: boolean;
    enabled: boolean;
    simulation: SimulationDescDTO;
}

export class DeviceConfigDTO {
    activationKey?: string;
    pairingEndpoint?: string;
    availableTagsFile?: string; // json array string
    availableTags?: TagDescDTO[]; // json array string
    simulateTags?: boolean;
    availableAlarms?: AlarmDescDTO[]; // json array string
    simulateAlarms?: boolean;
    packetFormat?: PacketFormatEnum;

    private arrayToMap(input: { name: string }[]): Map<string, any> {
        const map = new Map<string, any>();
        for (const item of input) {
            map.set(item.name, item);
        }
        return map;
    }

    private mapToArray(input: Map<string, any>) {
        const array = [];
        input.forEach((value, key) => {
            array.push({ name: key, value });
        });
        return array;
    }

    toDeviceConfig(): DeviceConfig {
        return {
            activationKey: this.activationKey,
            pairingEndpoint: this.pairingEndpoint,
            availableTagsFile: this.availableTagsFile,
            availableTags: this.arrayToMap(this.availableTags),
            simulateTags: this.simulateTags,
            availableAlarms: this.arrayToMap(this.availableAlarms),
            simulateAlarms: this.simulateAlarms,
            packetFormat: this.packetFormat,
        };
    }

    constructor(deviceConfig: DeviceConfig) {
        this.activationKey = deviceConfig.activationKey;
        this.pairingEndpoint = deviceConfig.pairingEndpoint;
        this.availableTagsFile = deviceConfig.availableTagsFile;
        this.availableTags = this.mapToArray(deviceConfig.availableTags);
        this.simulateTags = deviceConfig.simulateTags;
        this.availableAlarms = this.mapToArray(deviceConfig.availableAlarms);
        this.simulateAlarms = deviceConfig.simulateAlarms;
        this.packetFormat = deviceConfig.packetFormat;
    }
}
