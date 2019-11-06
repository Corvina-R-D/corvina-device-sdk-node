import BSON from 'bson'

export enum NoiseSimulationType {
    ABSOLUTE = "abs",
    PERCENT = "%"
}

export interface NoiseSimulationProperties
{
    type: NoiseSimulationType
    amplitude: number
}


export interface NullableSimulationStateMachine {
    nullifying: boolean
    start: number
    duration: number
}

export interface NullableSimulationProperties
{
    probability: number
    dt_min: number
    dt_max: number
    state ?: NullableSimulationStateMachine
}


export enum SimulationType {
    SINE = "sine",
    STEP = "step",
    CONST = "const",
    FUNCTION = "function"
}


export interface SimulationDesc {
    type: SimulationType,
    noise: NoiseSimulationProperties
    nullable: NullableSimulationProperties
}

export interface TagDesc {
    name: string,
    type: string,
    simulation: SimulationDesc
}

export interface MultiLangString
{
    [languageCode : string] : string;
}

export interface AlarmDesc {
    name: string,
    desc: MultiLangString,
    source: string,
    severity: number,
    ack_required: boolean,
    reset_required: boolean,
    enabled: boolean,
    simulation: SimulationDesc
}

export interface DataPoint {
    tagName: string; // tag name
    value: any;
    timestamp: number; // posix time
}

export enum AlarmState {
    ALARM_NONE = 0,
    ALARM_ENABLED = 1,
    ALARM_ACTIVE = 2,
    ALARM_ACKED = 4,
    ALARM_REQUIRES_ACK = 8,
    ALARM_REQUIRES_RESET = 16
}

export interface AlarmData {
    name: string,
    description: string,
    timestamp: Date,
    severity?: BSON.Int32,
    state: number,
    tag?: string,
    value_double?: number,
    value_integer?: BSON.Int32,
    value_boolean?: boolean,
    value_string?: string,
    value_longinteger?: BSON.Long,
    value_binaryblob?: BSON.Binary
}
