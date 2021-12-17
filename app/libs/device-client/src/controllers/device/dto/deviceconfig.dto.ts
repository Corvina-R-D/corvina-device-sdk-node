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
} from "../../../common/types";
import { DeviceConfig } from "../../../services/device.service";

export class NullableSimulationStateMachineDTO
    implements NullableSimulationStateMachine
{
    nullifying: boolean;
    start: number;
    duration: number;
}

export class NullableSimulationPropertiesDTO
    implements NullableSimulationProperties
{
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
    simulation: SimulationDescDTO;
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

export class DeviceConfigDTO implements DeviceConfig {
    activationKey?: string;
    pairingEndpoint?: string;
    availableTagsFile?: string; // json array string
    availableTags?: Array<TagDescDTO>; // json array string
    simulateTags?: boolean;
    availableAlarms?: Array<AlarmDescDTO>; // json array string
    simulateAlarms?: boolean;
    packetFormat?: PacketFormatEnum;
}
