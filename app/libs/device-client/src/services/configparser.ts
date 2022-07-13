import { l } from "../services/logger.service";
import { AggregatedMessagePublisher, MessagePublisher } from "./messagepublisher";
import { MessageSubscriber } from "./messagesubscriber";
import {
    MessagePublisherPolicy,
    MessagePublisher_OnChangedPolicy,
    MessagePublisher_TimerPolicy,
    MessagePublisher_AndPolicy,
    MessagePublisher_OnLevelPolicy,
    LevelMode,
    MessagePublisher_OnFieldLevelPolicy,
    MessagePublisher_OnFieldChangedPolicy,
    MessagePublisher_OrPolicy,
    MessagePublisher_AnalogBandPolicy,
} from "./messagepublisherpolicies";

export type TypedObject<T> = { [key: string]: T };
export type ConfigurationType = "datamodel";
export type PolicyType = "send" | "history";
export type PlatformConfigurationInterfaceType = "properties" | "datastream";
export type PlatformAggregationType = "object" | "individual";
export type OwnershipType = "device" | "server";

export type ModelBasicType =
    | "integer"
    | "double"
    | "string"
    | "boolean"
    | "bytestring"
    | "integerarray"
    | "doublearray"
    | "booleanarray"
    | "binaryblob";
export type ModelObjectType = "object";
export type ModelArrayType = "array";
export type ModelStructType = "struct";

export type MappingModeType = "R" | "RW";

export interface ModelBasic {
    type: ModelBasicType;
    description?: string;
    label?: string;
    unit?: string;
    tags?: string[];
    version?: string;
    deprecated?: boolean;
}

export interface ModelArray {
    UUID?: string;
    type: ModelArrayType;
    length: number;
    item: ModelObject; // TODO: Add ModelStruct
    description?: string;
    label?: string;
    unit?: string;
    tags?: string[];
    version?: string;
    deprecated?: boolean;
}

export interface ModelObject {
    UUID?: string;
    type: ModelObjectType;
    instanceOf: string;
    properties: TypedObject<ModelNode>;
    description?: string;
    label?: string;
    unit?: string;
    tags?: string[];
    version?: string;
    deprecated?: boolean;
}

export interface ModelStruct {
    UUID?: string;
    type: ModelStructType;
    instanceOf: string;
    properties: TypedObject<ModelBasic>;
    description?: string;
    label?: string;
    unit?: string;
    tags?: string[];
    version?: string;
    deprecated?: boolean;
}

export interface ModelMetadata {
    path: string;
    label?: string;
    description?: string;
    unit?: string;
    tags?: string[];

    type?: ModelType;
    version?: string;
    instanceOf?: string;
}

export type ModelNode = ModelBasic | ModelArray | ModelInterfaceCreatable;

export type ModelInterfaceCreatable = ModelObject | ModelStruct;

export type ModelType = ModelBasicType | ModelObjectType | ModelArrayType | ModelStructType;

// Mappings
export interface BasePolicyData {
    type: PolicyType;
    instanceOf?: string;
    [key: string]: any;
}

export interface MappingData {
    device_endpoint: string;
    server_endpoint?: string;
}

export interface MappingHistoryPolicy {
    enabled: boolean;
    limit?: string;
    compressionStrategy?: string;
}

export interface MappingSendPolicyTrigger {
    type: "timer" | "onchange" | "onlevel" | "fieldchange" | "fieldlevel";
    [key: string]: any;
}

export interface OnChangeTrigger extends MappingSendPolicyTrigger {
    minIntervalMs?: number;
    tagName?: string;
    skipFirstNChanges?: number;
    deadband?: number;
    deadbandPercent?: number;
    changeMask?: "value" | "timestamp" | "value|timestamp";
}

export interface IntervalTrigger extends MappingSendPolicyTrigger {
    intervalMs: number;
    type: "timer";
}

export interface OnLevelTrigger extends MappingSendPolicyTrigger {
    minIntervalMs?: number;
    tagName?: string;
    skipFirstNChanges?: number;
    level?: number;
    levelString?: string;
    mode?: LevelMode;
    deadband?: number;
    deadbandPercent?: number;
    changeMask?: "value" | "timestamp" | "value|timestamp";
    type: "onlevel";
}

export interface OnFieldChangeTrigger extends MappingSendPolicyTrigger {
    minIntervalMs?: number;
    tagName?: string;
    fieldName?: string;
    skipFirstNChanges?: number;
    deadband?: number;
    deadbandPercent?: number;
    changeMask?: "value" | "timestamp" | "value|timestamp";
    type: "fieldchange";
}

export interface OnFieldLevelTrigger extends MappingSendPolicyTrigger {
    minIntervalMs?: number;
    fieldName?: string;
    skipFirstNChanges?: number;
    level?: number;
    levelString?: string;
    mode?: LevelMode;
    deadband?: number;
    deadbandPercent?: number;
    changeMask?: "value" | "timestamp" | "value|timestamp";
    type: "fieldlevel";
}

export interface MappingSendPolicyCondition {
    type: "and" | "or" | "inband" | "outband";
}

export interface LogicCondition extends MappingSendPolicyCondition {
    type: "and" | "or";
    operands: MappingSendPolicyCondition[];
}

export interface InOutBandCondition extends MappingSendPolicyCondition {
    type: "inband" | "outband";
    low: number;
    high: number;
    tagName: string;
}

export interface MappingSendPolicy {
    triggers: MappingSendPolicyTrigger[];
    conditions?: MappingSendPolicyCondition;
}

export interface SendPolicyData extends BasePolicyData, MappingSendPolicy {}
export interface HistoryPolicyData extends BasePolicyData, MappingHistoryPolicy {}

export type PolicyData = SendPolicyData | HistoryPolicyData;

export interface MappingDatalink {
    source: string;
}

export interface MappingAdditionalInfo {
    mode?: MappingModeType;
    historyPolicy?: MappingHistoryPolicy;
    sendPolicy?: MappingSendPolicy;
    datalink?: MappingDatalink;
}

export interface MappingInfo {
    mapping?: MappingData;
}

export interface MappingBasic extends ModelBasic, MappingAdditionalInfo {}

export interface MappingObject extends ModelObject, MappingAdditionalInfo {
    properties: TypedObject<MappingNode>;
}

export interface MappingArray extends ModelArray, MappingAdditionalInfo {
    item: MappingObject; // TODO: Add PresetStruct
}

export interface MappingStruct extends ModelStruct, MappingAdditionalInfo {
    properties: TypedObject<MappingBasic>;
}

export type MappingNode = MappingBasic | MappingArray | MappingInterfaceCreatable;

export type MappingInterfaceCreatable = MappingObject | MappingStruct;

// Device configuration

export interface DeviceConfigurationBasic extends MappingBasic, MappingInfo {}

export interface DeviceConfigurationArray extends MappingArray, MappingInfo {
    item: DeviceConfigurationObject; // TODO: Add PresetStruct
}

export interface DeviceConfigurationObject extends MappingObject, MappingInfo {
    properties: TypedObject<DeviceConfigurationNode>;
}

export interface DeviceConfigurationStruct extends MappingStruct, MappingInfo {
    properties: TypedObject<DeviceConfigurationBasic>;
}

export type DeviceConfigurationWithProperties = DeviceConfigurationObject | DeviceConfigurationStruct;

export type DeviceConfigurationNode =
    | DeviceConfigurationBasic
    | DeviceConfigurationArray
    | DeviceConfigurationWithProperties;

export interface MappingsData {
    endpoint: string;
    type: ModelBasicType | ModelStructType;
    explicit_timestamp?: boolean;
}

export interface InterfaceData {
    interface_name: string;
    version_major: number;
    version_minor: number;
    type: PlatformConfigurationInterfaceType;
    ownership: OwnershipType;
    aggregation?: PlatformAggregationType;
    mappings: MappingsData[];
}

export interface ConfigurationData {
    UUID: string;
    type: ModelObjectType;
    instanceOf: string;
    policies?: TypedObject<PolicyData>;
    interfaces: InterfaceData[];
    properties: TypedObject<DeviceConfigurationNode>;
}

export interface DeviceConfigurationData {
    type: ConfigurationType;
    properties: TypedObject<ConfigurationData>;
}

class InvalidConfigurationError extends Error {}

function parseConditions(condition: MappingSendPolicyCondition): MessagePublisherPolicy {
    switch (condition.type) {
        case "and":
            {
                const andConditions = (condition as LogicCondition).operands.map(parseConditions);
                return new MessagePublisher_AndPolicy(andConditions);
            }
            break;
        case "or":
            {
                const orConditions = (condition as LogicCondition).operands.map(parseConditions);
                return new MessagePublisher_OrPolicy(orConditions);
            }
            break;
        case "inband":
        case "outband":
            {
                const inbandCondition = condition as InOutBandCondition;
                return new MessagePublisher_AnalogBandPolicy({
                    tagName: inbandCondition.tagName,
                    min: inbandCondition.low,
                    max: inbandCondition.high,
                    inside: inbandCondition.type === "inband",
                });
            }
            break;
    }
}

function parsePolicy(
    policyData: PolicyData,
    namedPolicies: Map<string, MessagePublisherPolicy>,
): MessagePublisherPolicy {
    if (policyData.type !== "send") {
        return;
    }

    if (policyData.instanceOf) {
        const namedPolicy = namedPolicies.get(policyData.instanceOf);
        if (!namedPolicy) {
            throw new InvalidConfigurationError(`Could not find referred policy ${policyData.instanceOf}`);
        }
        return namedPolicy.clone();
    }

    let result: MessagePublisherPolicy = undefined;

    // parse triggers
    const triggerOperands: MessagePublisherPolicy[] = [];
    for (const trigger of policyData.triggers) {
        switch (trigger.type) {
            case "timer":
                {
                    const timerTrigger = trigger as IntervalTrigger;
                    triggerOperands.push(new MessagePublisher_TimerPolicy(timerTrigger.intervalMs));
                }
                break;
            case "onchange":
                {
                    const onChangeTrigger = trigger as OnChangeTrigger;
                    const op1 = new MessagePublisher_OnChangedPolicy({
                        tagName: onChangeTrigger.tagName,
                        skipFirstNChanges: onChangeTrigger.skipFirstNChanges,
                        deadband:
                            onChangeTrigger.deadband != undefined
                                ? onChangeTrigger.deadband
                                : onChangeTrigger.deadbandPercent,
                        isPercent: onChangeTrigger.deadbandPercent != undefined,
                    });
                    if (onChangeTrigger.minIntervalMs != undefined) {
                        const op2 = new MessagePublisher_TimerPolicy(onChangeTrigger.minIntervalMs);
                        triggerOperands.push(new MessagePublisher_AndPolicy([op1, op2]));
                    } else {
                        triggerOperands.push(op1);
                    }
                }
                break;
            case "fieldchange":
                {
                    const onFieldChangeTrigger = trigger as OnFieldChangeTrigger;
                    const op1 = new MessagePublisher_OnFieldChangedPolicy({
                        fieldName: onFieldChangeTrigger.fieldName,
                        skipFirstNChanges: onFieldChangeTrigger.skipFirstNChanges,
                        deadband:
                            onFieldChangeTrigger.deadband != undefined
                                ? onFieldChangeTrigger.deadband
                                : onFieldChangeTrigger.deadbandPercent,
                        isPercent: onFieldChangeTrigger.deadbandPercent != undefined,
                    });
                    if (onFieldChangeTrigger.minIntervalMs != undefined) {
                        const op2 = new MessagePublisher_TimerPolicy(onFieldChangeTrigger.minIntervalMs);
                        triggerOperands.push(new MessagePublisher_AndPolicy([op1, op2]));
                    } else {
                        triggerOperands.push(op1);
                    }
                }
                break;
            case "onlevel":
                {
                    const onLevelTrigger = trigger as OnLevelTrigger;
                    const op = new MessagePublisher_OnLevelPolicy({
                        tagName: onLevelTrigger.tagName,
                        skipFirstNChanges: onLevelTrigger.skipFirstNChanges,
                        level:
                            onLevelTrigger.levelString != undefined ? onLevelTrigger.levelString : onLevelTrigger.level,
                        levelMode: onLevelTrigger.mode,
                        deadband:
                            onLevelTrigger.deadband != undefined
                                ? onLevelTrigger.deadband
                                : onLevelTrigger.deadbandPercent,
                        isPercent: onLevelTrigger.deadbandPercent != undefined,
                    });
                    if (onLevelTrigger.minIntervalMs != undefined) {
                        const op2 = new MessagePublisher_TimerPolicy(onLevelTrigger.minIntervalMs);
                        triggerOperands.push(new MessagePublisher_AndPolicy([op, op2]));
                    } else {
                        triggerOperands.push(op);
                    }
                }
                break;
            case "fieldLevel":
                const onFieldLevelTrigger = trigger as OnFieldLevelTrigger;
                const op = new MessagePublisher_OnFieldLevelPolicy({
                    fieldName: onFieldLevelTrigger.fieldName,
                    skipFirstNChanges: onFieldLevelTrigger.skipFirstNChanges,
                    level:
                        onFieldLevelTrigger.levelString != undefined
                            ? onFieldLevelTrigger.levelString
                            : onFieldLevelTrigger.level,
                    levelMode: onFieldLevelTrigger.mode,
                    deadband:
                        onFieldLevelTrigger.deadband != undefined
                            ? onFieldLevelTrigger.deadband
                            : onFieldLevelTrigger.deadbandPercent,
                    isPercent: onFieldLevelTrigger.deadbandPercent != undefined,
                });
                if (onFieldLevelTrigger.minIntervalMs != undefined) {
                    const op2 = new MessagePublisher_TimerPolicy(onFieldLevelTrigger.minIntervalMs);
                    triggerOperands.push(new MessagePublisher_AndPolicy([op, op2]));
                } else {
                    triggerOperands.push(op);
                }
                break;
        }
    }
    if (triggerOperands.length > 1) {
        result = new MessagePublisher_OrPolicy(triggerOperands);
    } else if (triggerOperands.length === 1) {
        result = triggerOperands[0].clone();
    }

    // parse conditions ( result = triggers & conditions )
    if (policyData.conditions) {
        const conditions = parseConditions(policyData.conditions);
        if (result == undefined) {
            result = conditions;
        } else {
            result = new MessagePublisher_AndPolicy([result, conditions]);
        }
    }

    return result;
}

/*! Apply index as ${0}, ${1} ..
 * Tag must be escaped !
 * Eg.  indexTemplateApply("/PLC_PRG/Tag1[${0},${1}]}", QStringList() << 2 << 3)
 */
export function indexTemplateApply(templateString: string, values: number[]): string {
    let output = "";
    let content = "";
    let index = -1;
    const ok = true;
    enum State {
        STRING,
        ESCAPING_STRING,
        ESCAPING_CONTENT,
        DOLLAR,
        CONTENT,
    }
    let state: State;
    state = State.STRING;
    for (let i = 0; i < templateString.length; i++) {
        if (state == State.ESCAPING_STRING) {
            output += templateString[i];
            state = State.STRING;
        } else if (state == State.ESCAPING_CONTENT) {
            output += templateString.at(i);
            state = State.CONTENT;
        } else {
            switch (templateString[i]) {
                case "\\":
                    state = (state as State) == State.CONTENT ? State.ESCAPING_CONTENT : State.ESCAPING_STRING;
                    break;
                case "$":
                    switch (state) {
                        case State.STRING:
                            state = State.DOLLAR;
                            break;
                        case State.DOLLAR: // case $$ => abort parsing
                            output += "$"; // flush prev $
                            state = State.DOLLAR;
                            break;
                        case State.CONTENT:
                            content += "$";
                            break;
                    }
                    break;
                case "{":
                    switch (state) {
                        case State.DOLLAR: // case $$ => abort parsing
                            state = State.CONTENT;
                            break;
                        case State.CONTENT:
                            content += "{";
                            break;
                        case State.STRING:
                            output += "{";
                            break;
                    }
                    break;
                case "}":
                    switch (state) {
                        case State.DOLLAR: // case $} => abort parsing
                            state = State.STRING;
                            output += "$}";
                            break;
                        case State.CONTENT:
                            state = State.STRING; // end of ${ ... }
                            index = parseInt(content);
                            if (index >= 0 && index < values.length) {
                                output += values[index];
                            }
                            content = "";
                            break;
                        case State.STRING:
                            output += "}";
                            break;
                    }
                    break;
                default:
                    switch (state) {
                        case State.CONTENT:
                            content += templateString[i];
                            break;
                        case State.DOLLAR:
                            output += "$";
                            output += templateString[i];
                            break;
                        case State.STRING:
                            output += templateString[i];
                            break;
                    }
                    break;
            }
        }
    }
    return output;
}

export interface DeviceConfiguration {
    interfaceNames: string[];
    tagPublishers: Map<string, Set<MessagePublisher>>;
    namedPolicies: Map<string, MessagePublisherPolicy>;
    subscribedTopics: Map<string, MessageSubscriber>;
}

function initPublisher(
    publisher: MessagePublisher,
    sourceTag: string,
    sendPolicy: MappingSendPolicy,
    deviceConfig: DeviceConfiguration,
) {
    l.debug("Init publisher", sourceTag, sendPolicy);
    const policy = parsePolicy({ type: "send", ...sendPolicy }, deviceConfig.namedPolicies);
    if (!policy) {
        return;
    }
    // Fix empty tag names in policy
    policy.setDefaultTagName(sourceTag);
    publisher.setPolicy(policy);

    const referencedTags = policy.referencedTags();
    // Add policy injected dependencies
    for (const i in referencedTags) {
        const tag = referencedTags[i];
        if (tag != sourceTag) {
            let pubs = deviceConfig.tagPublishers.get(tag);
            pubs = pubs == undefined ? new Set<MessagePublisher>() : pubs;
            pubs.add(publisher);
            deviceConfig.tagPublishers.set(tag, pubs);
        }
    }

    if (sourceTag != undefined) {
        let pubs = deviceConfig.tagPublishers.get(sourceTag);
        pubs = pubs == undefined ? new Set<MessagePublisher>() : pubs;
        pubs.add(publisher);
        deviceConfig.tagPublishers.set(sourceTag, pubs);
    }
}

function parseDeviceConfigurationNode({
    node,
    deviceConfig,
    nodeName,
    nodePath,
    parentNode,
    arrayIndexes,
    parentPublisher,
}: {
    node: DeviceConfigurationNode;
    deviceConfig: DeviceConfiguration;
    nodeName: string;
    nodePath: string;
    parentNode: DeviceConfigurationNode;
    arrayIndexes: number[];
    parentPublisher: MessagePublisher;
}) {
    //l.debug("parseDeviceConfigurationNode", node, nodeName, parentNode, arrayIndexes);

    const sourceTag =
        node.datalink && node.datalink.source ? indexTemplateApply(node.datalink.source, arrayIndexes) : undefined;
    const device_endpoint =
        node.mapping && node.mapping.device_endpoint
            ? indexTemplateApply(node.mapping.device_endpoint, arrayIndexes)
            : undefined;
    const server_endpoint =
        node.mapping && node.mapping.server_endpoint
            ? indexTemplateApply(node.mapping.server_endpoint, arrayIndexes)
            : undefined;

    switch (node.type) {
        case "object":
            for (const p of Object.keys(node.properties)) {
                const childNode = node.properties[p];
                parseDeviceConfigurationNode({
                    node: childNode,
                    deviceConfig,
                    nodeName: p,
                    nodePath: nodePath + "/" + p,
                    parentNode: node,
                    arrayIndexes,
                    parentPublisher: null,
                });
            }
            break;
        case "struct":
            let publisher: AggregatedMessagePublisher = undefined;
            if (node.sendPolicy) {
                publisher = new AggregatedMessagePublisher({
                    sourceTag,
                    modelPath: nodePath,
                    topic: device_endpoint,
                });
                initPublisher(publisher, sourceTag, node.sendPolicy, deviceConfig);
            } else {
                publisher = new AggregatedMessagePublisher({
                    sourceTag: undefined,
                    modelPath: nodePath,
                    topic: undefined,
                });
            }

            if (server_endpoint != undefined) {
                deviceConfig.subscribedTopics.set(
                    server_endpoint,
                    new MessageSubscriber({
                        topic: server_endpoint,
                        modelPath: nodePath,
                        topicType: node.type,
                    }),
                );
            }

            // parse subproperties
            for (const p of Object.keys(node.properties)) {
                const childNode = node.properties[p];
                parseDeviceConfigurationNode({
                    node: childNode,
                    deviceConfig,
                    nodeName: p,
                    nodePath: nodePath + "/" + p,
                    parentNode: node,
                    arrayIndexes,
                    parentPublisher: publisher,
                });
            }
            break;
        case "array":
            const len = node.length;
            for (let i = 0; i < len; i++) {
                const name = `${nodeName}[${i}]`;
                parseDeviceConfigurationNode({
                    node: node.item,
                    deviceConfig,
                    nodeName: name,
                    nodePath: nodePath + "/" + name,
                    parentNode: node,
                    arrayIndexes: [...arrayIndexes, i],
                    parentPublisher: null,
                });
            }
            break;
        default:
            // basic type
            if (parentNode.type == "object") {
                if (node.sendPolicy) {
                    const publisher = new MessagePublisher({
                        sourceTag,
                        modelPath: nodePath,
                        topic: device_endpoint,
                        topicType: node.type,
                    });
                    initPublisher(publisher, sourceTag, node.sendPolicy, deviceConfig);
                }
                if (server_endpoint != undefined) {
                    deviceConfig.subscribedTopics.set(
                        server_endpoint,
                        new MessageSubscriber({
                            topic: server_endpoint,
                            modelPath: nodePath,
                            topicType: node.type,
                        }),
                    );
                }
            } else if (parentNode.type == "struct") {
                if (node.sendPolicy) {
                    throw new InvalidConfigurationError(`Cannot specify send policy for struct properties`);
                }
                if (
                    (parentPublisher as AggregatedMessagePublisher).tagName &&
                    sourceTag &&
                    sourceTag != (parentPublisher as AggregatedMessagePublisher).tagName
                ) {
                    throw new InvalidConfigurationError(`Cannot mix field datalinks with whole structure datalinks`);
                }
                if (parentPublisher.tagName == undefined) {
                    const pub = parentPublisher as AggregatedMessagePublisher;
                    pub.addField({
                        tagName: sourceTag,
                        fieldName: nodeName,
                        type: node.type,
                    });
                    if (sourceTag != undefined) {
                        let pubs = deviceConfig.tagPublishers.get(sourceTag);
                        pubs = pubs == undefined ? new Set<MessagePublisher>() : pubs;
                        pubs.add(parentPublisher);
                        deviceConfig.tagPublishers.set(sourceTag, pubs);
                    }
                } else {
                    // in this case the whole datalink is repeated for each property, just skip it!
                }
                if (server_endpoint != undefined) {
                    deviceConfig.subscribedTopics.set(
                        server_endpoint,
                        new MessageSubscriber({
                            topic: server_endpoint,
                            modelPath: nodePath,
                            topicType: node.type,
                            fieldName: nodeName,
                        }),
                    );
                }
            }
            break;
    }
}

function simplifyInstanceOf(fullInstanceOf: string) {
    return fullInstanceOf.slice(0, fullInstanceOf.indexOf("."));
}

export default function parseDeviceConfig(config: DeviceConfigurationData): DeviceConfiguration {
    const result: DeviceConfiguration = {
        interfaceNames: [],
        tagPublishers: new Map<string, Set<MessagePublisher>>(),
        namedPolicies: new Map<string, MessagePublisherPolicy>(),
        subscribedTopics: new Map<string, MessageSubscriber>(),
    };

    if (!config.type || config.type !== "datamodel") {
        throw new InvalidConfigurationError(`Invalid type "${config.type}"`);
    }

    // expect to have at least one data model
    if (!config.properties || Object.keys(config.properties).length <= 0) {
        throw new InvalidConfigurationError(`Cannot find any configuration data`);
    }

    const configData: ConfigurationData = config.properties[Object.keys(config.properties)[0]];
    l.debug(`Parsing configuration data ${Object.keys(config.properties)[0]}`);

    // expect to have interfaces
    if (!configData.interfaces) {
        throw new InvalidConfigurationError(`Missing interfaces node`);
    }

    // extract all interface names
    result.interfaceNames = configData.interfaces.map(
        (i) => `${i.interface_name}:${i.version_major}:${i.version_minor}`,
    );
    l.log(`Found interfaces ${result.interfaceNames}`);

    // parse global policy definitions
    if (configData.policies) {
        for (const p of Object.keys(configData.policies)) {
            l.log(`Parsing policy ${p}`);
            const policyData = configData.policies[p];
            const policy = parsePolicy(policyData, result.namedPolicies);
            result.namedPolicies.set(p, policy);
        }
    }

    // parse properties
    for (const prop of Object.keys(configData.properties)) {
        parseDeviceConfigurationNode({
            node: configData.properties[prop],
            deviceConfig: result,
            nodeName: prop,
            nodePath: simplifyInstanceOf(configData.instanceOf) + "/" + prop,
            parentNode: configData,
            arrayIndexes: [],
            parentPublisher: null,
        });
    }

    return result;
}
