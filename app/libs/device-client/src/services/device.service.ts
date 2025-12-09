import { castCorvinaType, PacketFormatEnum } from "./../common/types";
import { State } from "./messagepublisherpolicies";
import pem from "pem";
import fs from "fs";
import LicensesAxiosInstance, { LicenseData, CrtData } from "./licensesaxiosinstance";
import mqtt, { IClientOptions, IClientPublishOptions, MqttClient } from "mqtt";
import BSON from "bson";
import _ from "lodash";
import { DataSimulator, AlarmSimulator, BaseSimulator, ConstSimulationProperties } from "./simulation";
import { TagDesc, AlarmDesc, DataPoint, AlarmData, AlarmCommand, SimulationType } from "../common/types";
import * as zlib from "zlib";

const assert = require("assert");

import CorvinaDataInterface, { PostCallback } from "./corvinadatainterface";
import { InternalMessageSenderOptions, MessageSenderOptions } from "./messagesender";
import { l } from "./logger.service";
import { MessageSubscriber } from "./messagesubscriber";
import { EventEmitter } from "stream";
import { get } from "http";
import * as https from "https";
import { buffer } from "stream/consumers";
//import { Manager } from "mqtt-jsonl-store"
import levelStore from "mqtt-level-store";
import { urlToHttpOptions } from "url";

const x509 = require("x509.js");

interface CSRData {
    csr: string;
    clientKey: string;
}

const ONLY_TEST_CONNECTION = process.env["ONLY_TEST_CONNECTION"] === "true" || false;

export { PostCallback } from "./corvinadatainterface";

export interface DeviceConfig {
    activationKey?: string;
    pairingEndpoint?: string;
    availableTagsFile?: string; // json array string
    availableTags?: Map<string, TagDesc>; // json array string
    dynamicTags?: Map<string, TagDesc>; // dynamic tags generated when posting json data
    simulateTags?: boolean;
    availableAlarms?: Map<string, AlarmDesc>; // json array string
    simulateAlarms?: boolean;
    packetFormat?: PacketFormatEnum;
}

export interface DeviceStatus {
    msgSent: number;
    bytesSent: number;
    inited: boolean;
    connected: boolean;
    ready: boolean;
}

/**
 * @class DeviceService
 * @summary Implements a Corvina virtual device
 * @description Implements a Corvina virtual device receiving the configuration from the cloud and providing tag and alarm simulation.
 */

/**
 * Manages the device identity and communication with the cloud
 */
export class DeviceService extends EventEmitter {
    protected inited: boolean;
    protected initPending: Promise<boolean>;
    protected readyToTransmit: boolean;
    protected licenseData: LicenseData;
    protected mqttClient: MqttClient;

    protected msgSentStats = 0;
    protected byteSentStats = 0;
    protected lastDateStats: number = Date.now();

    // If there are multiple endpoint options and one fails, this index is incremented to try the next broker url option
    protected lastTriedBrokerEndpoint = 0;

    protected empyCacheTopic: string;
    protected introspectionTopic: string;
    // publish introspection (required interfaces)
    protected static baseIntrospection =
        "com.corvina.control.sub.Config:0:2;com.corvina.control.pub.Config:0:2;com.corvina.control.pub.DeviceAlarm:2:0;com.corvina.control.sub.DeviceAlarm:1:0";
    protected customIntrospections: string;
    protected applyConfigTopic: string;
    protected consumerPropertiesTopic: string;
    protected actionAlarmTopic: string;
    protected configTopic: string;
    protected availableTagsTopic: string;

    protected lastConfig: string;

    protected _deviceConfig: DeviceConfig;
    protected axios: LicensesAxiosInstance;
    protected dataInterface: CorvinaDataInterface;

    // Message persistence
    protected messageStore: levelStore;
    // protected messageStore: Manager;
    protected defaultQoS: number = process.env["MQTT_DEFAULT_QOS"] ? parseInt(process.env["MQTT_DEFAULT_QOS"]) : 0;

    constructor() {
        super();
        if (process.env["MQTT_MSG_STORE_PATH"]) {
            this.messageStore = new levelStore(process.env["MQTT_MSG_STORE_PATH"]);
            // this.messageStore = new Manager(process.env["MQTT_MSG_STORE_PATH"]);
        }
        this._deviceConfig = {};
        this.dataInterface = new CorvinaDataInterface({
            sendMessage: this.sendMessage.bind(this),
        });

        if (process.env["NODE_TLS_REJECT_UNAUTHORIZED"] !== "0") {
            let currentCa = https.globalAgent?.options?.ca;
            if (currentCa) {
                currentCa = currentCa + "\n" + this.getCA();
            } else {
                currentCa = this.getCA();
            }
            https.globalAgent.options.ca = currentCa;
        }
    }

    get status(): DeviceStatus {
        return {
            msgSent: this.getMsgSent(),
            bytesSent: this.getBytesSent(),
            ready: this.isReady(),
            connected: this.isConnected(),
            inited: this.isInited(),
        };
    }

    get deviceConfig(): DeviceConfig {
        return this._deviceConfig;
    }

    getMsgSent() {
        return this.msgSentStats;
    }

    getBytesSent() {
        return this.byteSentStats;
    }

    getAppliedConfig(): DeviceConfig {
        return this.lastConfig as DeviceConfig;
    }

    getDeviceConfig() {
        return this._deviceConfig;
    }

    getLicenseData() {
        return this.licenseData;
    }

    public setCycleTime(cycleTime: number) {
        this.dataInterface.setCycleTime(cycleTime);
    }

    public reinit(deviceConfig: DeviceConfig, doInit = false): DeviceConfig {
        this.inited = false;
        this.readyToTransmit = false;
        if (this.mqttClient) {
            l.debug("Going to end mqtt client");
            this.mqttClient.end(true);
            this.mqttClient = null;
        } else {
            l.debug("No mqtt client to end");
        }
        DataSimulator.clear();
        this.initPending = null;
        this.licenseData = {} as LicenseData;
        this.customIntrospections = "";
        this.lastConfig = "";
        Object.assign(this._deviceConfig, deviceConfig);
        this._deviceConfig.dynamicTags = new Map<string, TagDesc>();
        l.info("Init with %j", this._deviceConfig);
        this.axios = new LicensesAxiosInstance(this._deviceConfig.pairingEndpoint, this._deviceConfig.activationKey);
        this.init();
        return this._deviceConfig;
    }

    public isInited() {
        return this.inited;
    }

    public isReady() {
        return this.readyToTransmit;
    }

    public isConnected() {
        return this.mqttClient && this.mqttClient.connected;
    }

    private setReady(ready: boolean) {
        if (this.readyToTransmit != ready) {
            this.readyToTransmit = ready;
            if (ready) {
                this.emit("ready", ready);
            } else {
                this.emit("not_ready", ready);
            }
        }
    }

    private createCSR(logicalId: string): Promise<CSRData> {
        return new Promise((resolve, reject) => {
            pem.createCSR(
                {
                    organization: "System",
                    commonName: `${this.licenseData.logicalId}`,
                },
                (err, obj) => {
                    if (err == null) {
                        l.debug("PEM RETURNED %s %s", err, obj);
                        resolve(obj);
                    } else {
                        reject(err);
                    }
                },
            );
        });
    }

    public async applyConfig(config: any) {
        if (JSON.stringify(config) == JSON.stringify(this.lastConfig)) {
            l.info("Found same config => return");
            return;
        }

        if (this.initPending) {
            await this.initPending;
        }

        this.setReady(false);
        this.customIntrospections = "";
        l.debug("Apply config: %s", JSON.stringify(config));
        this.dataInterface.applyConfig(config);
        this.dataInterface.config.interfaceNames.forEach((interfaceName) => {
            this.customIntrospections += `;${interfaceName}`;
        });

        l.debug("Applied config done!");

        this.lastConfig = config;
        setTimeout(async () => {
            l.debug("Going to end mqtt client");
            await this.mqttClient.end();
            // await this.messageStore.open();
            setTimeout(
                async () =>
                    await this.mqttClient.reconnect({
                        incomingStore: this.messageStore?.incoming,
                        outgoingStore: this.messageStore?.outgoing,
                    }),
                1000,
            );
        }, 0);
    }

    private serializeMessage(msg: any): any {
        if (this._deviceConfig.packetFormat == PacketFormatEnum.BSON) {
            return BSON.serialize({ v: msg.v, t: new Date(msg.t), m: msg.m });
        } else {
            return JSON.stringify(msg);
        }
    }

    private getCA(): string | Buffer {
        if (process.env["BROKER_CA_FILE"]) {
            try {
                return fs.readFileSync(process.env["BROKER_CA_FILE"]);
            } catch (e) {
                l.error("Error reading CA file: %s", e);
                return "";
            }
        }
        return `-----BEGIN CERTIFICATE-----
MIICWTCCAf+gAwIBAgIUAkkMEwP0AejpBDLeXUiBRJSDv7UwCgYIKoZIzj0EAwIw
eTELMAkGA1UEBhMCSVQxDjAMBgNVBAgMBUl0YWx5MSgwJgYDVQQKDB9FeG9yIERl
dmljZXMgRGlnaXRhbCBJZGVudGl0aWVzMTAwLgYDVQQDDCdFeG9yIERldmljZXMg
RGlnaXRhbCBJZGVudGl0aWVzIFJvb3QgQ0EwIBcNMjAxMjEwMTAwOTQ5WhgPMjA2
MjAxMDQxMDA5NDlaMHkxCzAJBgNVBAYTAklUMQ4wDAYDVQQIDAVJdGFseTEoMCYG
A1UECgwfRXhvciBEZXZpY2VzIERpZ2l0YWwgSWRlbnRpdGllczEwMC4GA1UEAwwn
RXhvciBEZXZpY2VzIERpZ2l0YWwgSWRlbnRpdGllcyBSb290IENBMFkwEwYHKoZI
zj0CAQYIKoZIzj0DAQcDQgAEQGKIj1KpHpRk5ZOYvf9g33ENs2gOBu3RsCneaYKQ
Jhhl8wzVnt8vA4wzgv7B9Jui5+efYIk9N19jZ9H8JAjDZKNjMGEwHQYDVR0OBBYE
FO3l09dQYmSZ5+VuR8IDyNDSrP8cMB8GA1UdIwQYMBaAFO3l09dQYmSZ5+VuR8ID
yNDSrP8cMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMAoGCCqGSM49
BAMCA0gAMEUCIEBfvBPKnQSGQhk/JLvtdsC9AUhzmpnmXKqztImkkkfJAiEAqEOc
fLibdXgfUjlbFwApfXoXZsYZMwyFq/HjIKS1pyA=
-----END CERTIFICATE-----`;
    }

    private connectClient(broker_url: string, key: string, crt: string): Promise<any> {
        l.info("Connecting to mqtt broker %s", broker_url);

        return new Promise(async (resolve, reject) => {
            const mqttClientOptions: IClientOptions = {};
            mqttClientOptions.rejectUnauthorized = process.env["NODE_TLS_REJECT_UNAUTHORIZED"] === "0" ? false : true;
            mqttClientOptions.ca = this.getCA();
            mqttClientOptions.key = key;
            mqttClientOptions.cert = crt;
            mqttClientOptions.clean = true;
            mqttClientOptions.clientId = x509.parseCert(crt).subject.commonName;
            mqttClientOptions.reconnectPeriod = 10000;
            l.debug(mqttClientOptions, "MQTT options");

            // await this.messageStore.open();
            mqttClientOptions.incomingStore = this.messageStore?.incoming;
            mqttClientOptions.outgoingStore = this.messageStore?.outgoing;

            this.mqttClient = mqtt.connect(broker_url, mqttClientOptions);

            l.debug("MQTT client created");

            this.mqttClient.on("connect", async (v) => {
                l.info("Successfully connected to mqtt broker!", JSON.stringify(v));

                this.subscribeChannel(this.consumerPropertiesTopic);
                this.subscribeChannel(this.applyConfigTopic);
                this.subscribeChannel(this.actionAlarmTopic);
                if (ONLY_TEST_CONNECTION) {
                    l.info("Connection test successful!");
                    process.exit(0);
                }

                l.debug("Published introspection " + DeviceService.baseIntrospection + this.customIntrospections);
                await this.sendStringMessage(
                    this.introspectionTopic,
                    DeviceService.baseIntrospection + this.customIntrospections,
                    { qos: 2 },
                );
                // Empty properties cache
                l.debug("Published empty cache");
                await this.sendStringMessage(this.empyCacheTopic, "1", {
                    qos: 2,
                });

                l.debug("Published configuration");
                await this.sendStringMessage(
                    this.configTopic,
                    this.serializeMessage({
                        v: JSON.stringify(this.lastConfig),
                        t: Date.now(),
                    }),
                    { qos: 2 },
                );

                this.throttledUpdateAvailableTags();

                if (this.dataInterface.config) {
                    this.dataInterface.config.subscribedTopics.forEach((topic, topicName) => {
                        this.subscribeChannel(this.licenseData.realm + "/" + this.licenseData.logicalId + topicName);
                    });
                }

                this.setReady(true);
                l.info("Ready to transmit!");

                DataSimulator.clear();
                if (this._deviceConfig.simulateTags) {
                    this._deviceConfig.availableTags.forEach((value) => {
                        if (value.simulation === null) {
                            return;
                        }
                        new DataSimulator(
                            value.name,
                            value.type,
                            async (t, v, ts) => {
                                if (this.isReady()) {
                                    return this._internalPost([{ tagName: t, value: v, timestamp: ts }], true);
                                }
                                return false;
                            },
                            value.simulation,
                        );
                    });
                    if (this._deviceConfig.simulateAlarms) {
                        this._deviceConfig.availableAlarms.forEach((value) => {
                            new AlarmSimulator(value, async (data: AlarmData) => {
                                if (this.isReady()) {
                                    return this.postAlarm(data);
                                }
                                return false;
                            });
                        });
                    }
                }

                resolve(true);
            });

            this.mqttClient.on("close", () => {
                DataSimulator.clear();
                l.warn("Stream closed!");
            });

            this.mqttClient.on("reconnect", () => {
                DataSimulator.clear();
                l.warn("Stream reconnected!");
            });

            this.mqttClient.on("error", (error) => {
                l.error(error, "Stream error!");
                this.lastTriedBrokerEndpoint++;
                reject(error);
            });

            this.mqttClient.on("message", async (topic, message) => {
                l.info(`Received message on ${topic}\n`);
                let decodedMsg: any;
                switch (topic) {
                    case this.consumerPropertiesTopic.toString():
                        decodedMsg = zlib.unzipSync(message.slice(4)).toString();
                        l.debug("Received consumer properties!");
                        l.trace(`<<<< %s %j %d %j`, topic, decodedMsg, message.length, message);
                        break;
                    case this.applyConfigTopic.toString():
                        decodedMsg = BSON.deserialize(message);
                        l.trace(`<<<< %s %j %d %j`, topic, decodedMsg, message.length, message);
                        this.applyConfig(JSON.parse(decodedMsg.v));
                        break;
                    case this.actionAlarmTopic.toString():
                        decodedMsg = BSON.deserialize(message);
                        l.trace(`<<<< %s %j %d %j`, topic, decodedMsg, message.length, message);
                        const x: AlarmCommand = decodedMsg.v;
                        const sim: AlarmSimulator = BaseSimulator.simulatorsByTagName.get(
                            AlarmSimulator.alarmSimulatorMapkey(x.name),
                        ) as AlarmSimulator;
                        if (!sim) {
                            l.error("Trying to perform action on unknown alarm %s", x.name);
                        } else {
                            switch (x.command) {
                                case "ack":
                                    sim.acknowledge(x.evTs, x.user, x.comment);
                                    break;
                                case "reset":
                                    sim.reset(x.evTs, x.user, x.comment);
                                    break;
                            }
                        }
                        break;
                    default:
                        decodedMsg = BSON.deserialize(message);
                        l.trace(`<<<< %s %j %d %j`, topic, decodedMsg, message.length, message);
                        const topicKey = topic.slice(
                            this.licenseData.logicalId.length + this.licenseData.realm.length + 1,
                        );
                        const subscriber = this.dataInterface.config.subscribedTopics.get(topicKey);
                        if (subscriber) {
                            this.onWrite(subscriber, decodedMsg);

                            // notify any simulation about the external write
                            if (this._deviceConfig.simulateTags) {
                                this.applyBackToSimulation(subscriber.targetTag, decodedMsg.v);
                            }
                        } else {
                            l.info("Nothing to do for topic ", topic);
                        }
                }
            });
        });
    }

    private subscribeChannel(channel: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.mqttClient.subscribe(channel, function (err) {
                if (!err) {
                    resolve(true);
                } else {
                    l.warn(err, `Error subscribing %s`, channel);
                    reject(err);
                }
            });
        });
    }

    public async sendStringMessage(channel: string, message: string, options: any = {}): Promise<any> {
        l.debug("Going to publish %s", channel);

        return new Promise((resolve, reject) => {
            this.mqttClient.publish(channel, message, options, (err) => {
                if (!err) {
                    resolve(true);
                } else {
                    l.warn(`Error publishing to ${channel}: %j`, err);
                    reject(err);
                }
            });
        });
    }

    public async sendMessage(
        topic: string,
        payload: { t: number; v: unknown },
        options?: InternalMessageSenderOptions,
    ): Promise<any> {
        topic = this.licenseData.realm + "/" + this.licenseData.logicalId + topic;
        const message = this.serializeMessage(payload);

        this.byteSentStats += message.length;
        this.msgSentStats += 1;
        const timeDiff = Date.now() - this.lastDateStats;
        if (timeDiff > 10000) {
            this.byteSentStats = 0;
            this.msgSentStats = 0;
            this.lastDateStats = this.lastDateStats + timeDiff;
        }
        l.debug("Going to send to topic %s", topic);
        try {
            if (!this.readyToTransmit) {
                const err = `Cannot publish if not ready to transmit`;
                l.warn(err);
                if (options?.cb) {
                    options.cb(new Error(err), undefined);
                }
                throw "Cannot publish if not ready to transmit";
            }
            options = options || { qos: this.defaultQoS };
            if (!options.qos) {
                options.qos = this.defaultQoS;
            }

            l.trace(">>>> %s %j %d %j QoS %d", topic, payload, message.length, message, options.qos);
            if (options?.cb) {
                await this.mqttClient.publish(topic, message, options as IClientPublishOptions, (err, packet) => {
                    options.cb(err, packet);
                });
            } else {
                await this.mqttClient.publish(topic, message, options as IClientPublishOptions);
            }
        } catch (e) {
            l.error("Got error while publishing: ");
            l.error(e);
            return false;
        }
    }

    private async _asyncInit(): Promise<boolean> {
        try {
            this.licenseData = await this.axios.init();
            l.debug("Got api key %j ", this.licenseData);
            this.inited = true;

            /* Below steps should be cached to disk */

            // create identity
            const csr: CSRData = await this.createCSR(this.licenseData.logicalId);

            // take first protocol available. Todo: ensures is valid
            //const mqtt_protocol_name = Object.keys(info.protocols)[0]
            //const mqtt_protocol = info.protocols[mqtt_protocol_name]

            l.info({ msg: "CSR created", csr });

            // sign the certificate
            const crt: CrtData = await this.axios.doPairing(csr.csr);

            l.info({ msg: "Certificate signed", crt });

            // verify the certificate
            assert(await this.axios.verify(crt.client_crt));

            /* ************************************* */

            this.empyCacheTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/control/emptyCache`;
            this.introspectionTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}`;
            this.consumerPropertiesTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/control/consumer/properties`;
            this.applyConfigTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.sub.Config/applyConfiguration`;
            this.actionAlarmTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.sub.DeviceAlarm/a`;
            this.configTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.pub.Config/configuration`;
            this.availableTagsTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.pub.Config/availableTags`;

            // connect mqtt
            await this.connectClient(
                this.licenseData.brokerUrls[this.lastTriedBrokerEndpoint % this.licenseData.brokerUrls.length],
                csr.clientKey,
                crt.client_crt,
            );
        } catch (err) {
            this.inited = false;
            throw err;
        }

        return this.inited;
    }

    private async init(): Promise<boolean> {
        if (this.inited == false && this.initPending == null) {
            // do the async call
            this.initPending = this._asyncInit();
            try {
                await this.initPending;
            } catch (err) {
                l.error("Error initing:");
                l.error(err);
                this.initPending = null;
                const randomRetry = 5 + 10 * Math.random();
                l.warn(`Retry init in  ${randomRetry} secs`);

                if (this.mqttClient) {
                    l.debug("Going to end mqtt client");
                    this.mqttClient.end(true);
                    this.mqttClient = null;
                } else {
                    l.debug("No mqtt client to end");
                }

                setTimeout(() => {
                    this.init();
                }, randomRetry * 1000);
            }
            this.initPending = null;
        }
        return this.inited;
    }

    private throttledUpdateAvailableTags = _.throttle(
        async () => {
            try {
                await this.sendStringMessage(
                    this.availableTagsTopic,
                    this.serializeMessage({
                        v: JSON.stringify([
                            ...this._deviceConfig.availableTags.values(),
                            ...(this._deviceConfig.dynamicTags ? this._deviceConfig.dynamicTags.values() : []),
                        ]),
                        t: Date.now(),
                    }),
                    { qos: 2 },
                );
            } catch (e) {}
        },
        1000,
        { leading: false, trailing: true },
    );

    private jsToCorvinaType(value): string {
        switch (typeof value) {
            case "number":
                return "double";
            case "string":
                return "string";
            case "object":
                if (_.isArray(value)) {
                    if (value.length > 0 && typeof value[0] === "string") {
                        return "stringarray";
                    }
                    return "doublearray";
                } else {
                    return "struct";
                }
                break;
            default:
                return undefined;
        }
    }

    private applyBackToSimulation(tagName: string, value: any) {
        // do we have a simulation for this tagName? If yes, update the simulation value as well
        const sim = BaseSimulator.simulatorsByTagName.get(tagName) as DataSimulator;
        if (sim) {
            sim.value = value;
            sim.lastSentValue = value;
            if (sim.desc?.type == SimulationType.CONST) {
                (sim.desc as ConstSimulationProperties).value = value;
            }
        } else {
            // setup a DataSimulator of type const with the injected value if simulation is enabled
            if (this._deviceConfig.simulateTags) {
                const sim = new DataSimulator(
                    tagName,
                    this.jsToCorvinaType(value),
                    async (t, v, ts) => {
                        if (this.isReady()) {
                            return this._internalPost([{ tagName: t, value: v, timestamp: ts }], true);
                        }
                        return false;
                    },
                    { type: SimulationType.CONST, value: value },
                );
                l.info("Inited new const simulator  ", sim);
            }
        }
    }

    private recurseNotifyObject = (
        prefix: string,
        rootValue: Record<string, any>,
        ts: number,
        calledFromSimulation: boolean,
        options?: MessageSenderOptions,
    ) => {
        _.mapKeys(rootValue, (value, key) => {
            const decoratedName = `${prefix}${key}`;
            if (_.isArray(value) && value.length > 0 && !_.isObject(value[0])) {
                for (const e in value as Array<any>) {
                    this.recurseNotifyObject(`${decoratedName}[${e}]`, value[e], ts, calledFromSimulation, options);
                }
            } else if (_.isObject(value)) {
                this.recurseNotifyObject(decoratedName + ".", value, ts, calledFromSimulation, options);
            }
            if (
                this._deviceConfig.dynamicTags &&
                !this._deviceConfig.dynamicTags.has(decoratedName) &&
                !this._deviceConfig.availableTags.has(decoratedName) &&
                value != undefined
            ) {
                this._deviceConfig.dynamicTags.set(decoratedName, {
                    name: decoratedName,
                    type: this.jsToCorvinaType(value), // better implement type detection
                } as TagDesc);
                this.throttledUpdateAvailableTags();
            }
            if (this.dataInterface.config) {
                // do we have a simulation for this tagName? If yes, update the simulation value as well
                if (!calledFromSimulation) {
                    this.applyBackToSimulation(decoratedName, value);
                }

                this.dataInterface.notifyTag(decoratedName, new State(value, ts), options);
            }
        });
        if (this.dataInterface.config && prefix.length > 0) {
            this.dataInterface.notifyTag(
                prefix.endsWith(".") ? prefix.slice(0, -1) : prefix,
                new State(rootValue, ts),
                options,
            );
        }
    };

    async post(dataPoints: Array<DataPoint>, options?: MessageSenderOptions): Promise<boolean> {
        return this._internalPost(dataPoints, false, options);
    }

    /**
     *
     * @param dataPoints
     * @returns
     */
    private async _internalPost(dataPoints: Array<DataPoint>, calledFromSimulation: boolean, options?: MessageSenderOptions): Promise<boolean> {
        if (!this.readyToTransmit) {
            const err = `Cannot process ${JSON.stringify(dataPoints)}. Device not ready to transmit!`;
            if (options?.cb) {
                options.cb(new Error(err), undefined, undefined);
            }
            l.info(err);
            return false;
        }

        // notify the tags (if configured) and update available tags
        for (const dp of dataPoints) {
            if (dp.tagName == undefined) {
                assert(_.isObject(dp.value) && !_.isArray(dp.value));
                this.recurseNotifyObject("", dp.value, dp.timestamp, calledFromSimulation, options);
            } else {
                // else notify single components
                if (_.isObject(dp.value) && !options?.recurseNotifyOnlyWholeObject && !_.isArray(dp.value)) {
                    this.recurseNotifyObject(dp.tagName + ".", dp.value, dp.timestamp, calledFromSimulation, options);
                } else {
                    if (this.dataInterface.config) {
                        if (!calledFromSimulation) {
                            this.applyBackToSimulation(dp.tagName as string, dp.value);
                        }

                        // try to notify whole object
                        this.dataInterface.notifyTag(dp.tagName as string, new State(dp.value, dp.timestamp), options);
                    }
                }
            }
        }

        // notify error if not yet configured
        if (!this.dataInterface.config) {
            const err = `Cannot process ${JSON.stringify(dataPoints)}. Device is not configured yet!`;
            l.info(err);
            if (options?.cb) {
                options.cb(new Error(err), undefined, undefined);
            }
            return false;
        }

        return true;
    }

    async postAlarm(alarmData: AlarmData): Promise<boolean> {
        const payload = this.serializeMessage({ t: Date.now(), v: alarmData });
        const topic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.pub.DeviceAlarm/a`;
        l.debug("Going to send alarm ");
        l.trace(">>>> %s %j %d %j", topic, { t: Date.now(), v: alarmData }, payload.length, payload);
        await this.mqttClient.publish(topic, payload, { qos: 2 });
        return true;
    }

    protected onWrite(subscriber: MessageSubscriber, message: any) {
        l.debug("CorvinaDataInterface.onWrite %j", message);
        this.emit("write", {
            topic: subscriber.topic,
            modelPath: subscriber.modelPath,
            fieldName: subscriber.fieldName,
            tagName: subscriber.targetTag,
            v: castCorvinaType(message.v, subscriber.topicType),
        });
    }
}
