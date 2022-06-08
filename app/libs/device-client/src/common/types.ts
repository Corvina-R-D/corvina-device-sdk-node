import BSON, { Int32, Long, Binary } from "bson";

export enum NoiseSimulationType {
    ABSOLUTE = "abs",
    PERCENT = "%",
}

export interface NoiseSimulationProperties {
    type: NoiseSimulationType;
    amplitude: number;
}

export interface NullableSimulationStateMachine {
    nullifying: boolean;
    start: number;
    duration: number;
}

export interface NullableSimulationProperties {
    probability: number;
    dt_min: number;
    dt_max: number;
    state?: NullableSimulationStateMachine;
}

export enum SimulationType {
    SINE = "sine",
    STEP = "step",
    CONST = "const",
    FUNCTION = "function",
}

export interface SimulationDesc {
    type: SimulationType;
    noise: NoiseSimulationProperties;
    nullable: NullableSimulationProperties;
}

export interface TagDesc {
    name: string;
    type: string;
    simulation?: SimulationDesc;
}

export interface MultiLangString {
    [languageCode: string]: string;
}

export interface AlarmDesc {
    name: string;
    desc: MultiLangString;
    source: string;
    severity: number;
    ack_required: boolean;
    reset_required: boolean;
    enabled: boolean;
    simulation: SimulationDesc;
}

/**
 * tagName can be undefined, and in that case value is expected to be an object
 */
export interface DataPoint {
    tagName: string | undefined;
    value: any;
    timestamp: number; // posix time
}

export enum AlarmState {
    ALARM_NONE = 0,
    ALARM_ENABLED = 1,
    ALARM_ACTIVE = 2,
    ALARM_ACKED = 4,
    ALARM_REQUIRES_ACK = 8,
    ALARM_REQUIRES_RESET = 16,
}

export interface AlarmData {
    name: string;
    desc: string;
    ts: Date;
    evTs: Date;
    sev?: Int32;
    state: number;
    tag?: string;
    v_d?: number;
    v_i?: Int32;
    v_b?: boolean;
    v_s?: string;
    v_l?: Long;
    v_o?: Binary;
}

export interface AlarmCommand {
    command: string;
    comment: string;
    evTs: number;
    name: string;
    user: string;
}

export enum PacketFormatEnum {
    JSON = "json",
    BSON = "bson",
}

export function castCorvinaType(value: any, topicType: string) {
    switch (topicType) {
        case "integer":
            return ~~value;
        case "boolean":
            if (typeof value == "string") {
                if (value == "true") {
                    return true;
                } else if (value == "false") {
                    return false;
                } else {
                    return !!~~value;
                }
            }
            return !!value;
        case "string":
            return "" + value;
        case "double":
            return parseFloat(value);
        case "struct":
            break;
        default:
            throw "Unsupported data type " + topicType;
    }
    return value;
}