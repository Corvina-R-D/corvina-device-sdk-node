import { PacketFormatEnum } from "./../common/types";
import { State } from "./messagepublisherpolicies";
import { Logger as l } from "@nestjs/common";
import pem from "pem";
import LicensesAxiosInstance, { LicenseData, CrtData } from "./licensesaxiosinstance";
import mqtt, { IClientOptions, MqttClient } from "mqtt";
import BSON from "bson";
import _ from "lodash";
import { DataSimulator, AlarmSimulator, BaseSimulator } from "./simulation";
import { TagDesc, AlarmDesc, DataPoint, AlarmData, AlarmCommand } from "../common/types";
import { Injectable } from "@nestjs/common";

const assert = require("assert");

import CorvinaDataInterface from "./corvinadatainterface";

const x509 = require("x509.js");

interface CSRData {
    csr: string;
    clientKey: string;
}

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
@Injectable()
export class DeviceService extends CorvinaDataInterface {
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

    constructor() {
        super();
        this._deviceConfig = {};
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

    public reinit(deviceConfig: DeviceConfig, doInit = false): DeviceConfig {
        this.inited = false;
        this.readyToTransmit = false;
        if (this.mqttClient) {
            this.mqttClient.end();
            this.mqttClient = null;
        }
        DataSimulator.clear();
        this.initPending = null;
        this.licenseData = {} as LicenseData;
        this.customIntrospections = "";
        this.lastConfig = "";
        Object.assign(this._deviceConfig, deviceConfig);
        this._deviceConfig.dynamicTags = new Map<string, TagDesc>();
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
        return this.mqttClient.connected;
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
                        l.debug("PEM RETURNED", err, obj);
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
            l.log("Found same config => return");
            return;
        }

        if (this.initPending) {
            await this.initPending;
        }

        this.readyToTransmit = false;
        this.customIntrospections = "";
        l.debug("Apply config: ", JSON.stringify(config));
        super.applyConfig(config);
        this._config.interfaceNames.forEach((interfaceName) => {
            this.customIntrospections += `;${interfaceName}`;
        });

        l.debug("done !");

        this.lastConfig = config;
        setTimeout(async () => {
            await this.mqttClient.end();
            setTimeout(async () => await this.mqttClient.reconnect(), 1000);
        }, 0);
    }

    private serializeMessage(msg: any): any {
        if (this._deviceConfig.packetFormat == PacketFormatEnum.BSON) {
            return BSON.serialize(msg);
        } else {
            return JSON.stringify(msg);
        }
    }

    private connectClient(broker_url: string, key: string, crt: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const mqttClientOptions: IClientOptions = {};
            mqttClientOptions.rejectUnauthorized = false;
            mqttClientOptions.key = key;
            mqttClientOptions.cert = crt;
            mqttClientOptions.clean = true;
            mqttClientOptions.clientId = x509.parseCert(crt).subject.commonName;
            mqttClientOptions.reconnectPeriod = 5000000;
            this.mqttClient = mqtt.connect(broker_url, mqttClientOptions);

            this.subscribeChannel(this.consumerPropertiesTopic);
            this.subscribeChannel(this.applyConfigTopic);
            this.subscribeChannel(this.actionAlarmTopic);

            this.mqttClient.on("connect", async (v) => {
                l.log("Successfully connected to mqtt broker!", JSON.stringify(v));

                l.debug("published introspection " + DeviceService.baseIntrospection + this.customIntrospections);
                await this.sendStringMessage(
                    this.introspectionTopic,
                    DeviceService.baseIntrospection + this.customIntrospections,
                    { qos: 2 },
                );
                // Empty properties cache
                l.debug("published empty cache");
                await this.sendStringMessage(this.empyCacheTopic, "1", {
                    qos: 2,
                });

                l.debug("published configuration");
                await this.sendStringMessage(
                    this.configTopic,
                    this.serializeMessage({
                        v: JSON.stringify(this.lastConfig),
                        t: Date.now(),
                    }),
                    { qos: 2 },
                );

                this.throttledUpdateAvailableTags();

                if (this._config) {
                    this._config.subscribedTopics.forEach((topic, topicName) => {
                        this.subscribeChannel(this.licenseData.realm + "/" + this.licenseData.logicalId + topicName);
                    });
                }

                this.readyToTransmit = true;
                l.log("Ready to transmit!");

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
                                    return this.post([{ tagName: t, value: v, timestamp: ts }]);
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

            this.mqttClient.on("close", (v) => {
                DataSimulator.clear();
                l.warn("Stream closed!", v);
            });

            this.mqttClient.on("reconnect", (v) => {
                DataSimulator.clear();
                l.warn("Stream reconnected!", v);
            });

            this.mqttClient.on("error", (error) => {
                l.error("Stream error!", error);
                this.lastTriedBrokerEndpoint++;
                reject(error);
            });

            this.mqttClient.on("message", (topic, message) => {
                l.log(`Received message on ${topic} \n`);
                switch (topic) {
                    case this.consumerPropertiesTopic.toString():
                        l.debug("Received consumer properties!");
                        break;
                    case this.applyConfigTopic.toString():
                        this.applyConfig(JSON.parse(BSON.deserialize(message).v));
                        break;
                    case this.actionAlarmTopic.toString():
                        //console.log( JSON.parse(BSON.deserialize(message).v) )
                        const x: AlarmCommand = BSON.deserialize(message).v;
                        const sim: AlarmSimulator = BaseSimulator.simulatorsByTagName.get(
                            AlarmSimulator.alarmSimulatorMapkey(x.name),
                        ) as AlarmSimulator;
                        if (!sim) {
                            l.error("Trying to perform action on unknown alarm ", x.name);
                        } else {
                            switch (x.command) {
                                case "ack":
                                    sim.acknoledge(x.evTs, x.user, x.comment);
                                    break;
                                case "reset":
                                    sim.reset(x.evTs, x.user, x.comment);
                                    break;
                            }
                        }
                        break;
                    default:
                        const topicKey = topic.slice(
                            this.licenseData.logicalId.length + this.licenseData.realm.length + 1,
                        );
                        const subscriber = this._config.subscribedTopics.get(topicKey);
                        if (subscriber) {
                            this.onWrite(subscriber, BSON.deserialize(message));
                        } else {
                            l.log("Nothing to do for topic ", topic);
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
                    l.warn(`Error subscribing ${channel}: `, err);
                    reject(err);
                }
            });
        });
    }

    public async sendStringMessage(channel: string, message: string, options: any = {}): Promise<any> {
        l.debug("Going to publish ", channel /*, message */, this.readyToTransmit);

        return new Promise((resolve, reject) => {
            this.mqttClient.publish(channel, message, options, (err) => {
                if (!err) {
                    resolve(true);
                } else {
                    l.warn(`Error publishing to ${channel}: `, err);
                    reject(err);
                }
            });
        });
    }

    public async sendMessage(topic: string, payload: { t: number; v: unknown }, options: any = {}): Promise<any> {
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
        l.debug("Going to send to topic ", topic, this.readyToTransmit);
        try {
            if (!this.readyToTransmit) {
                l.warn("Cannot publish if not ready to transmit", this.readyToTransmit);
                throw "Cannot publish if not ready to transmit";
            }
            console.debug(">>>>", topic, payload, topic.length, message.length, message);
            await this.mqttClient.publish(topic, message);
        } catch (e) {
            l.error("Got error while publishing: ", e);
            return false;
        }
    }

    private async _asyncInit(): Promise<boolean> {
        try {
            this.licenseData = await this.axios.init();
            l.debug("Got api key ", this.licenseData);
            this.inited = true;

            /* Below steps should be cached to disk */

            // create identity
            const csr: CSRData = await this.createCSR(this.licenseData.logicalId);

            // take first protocol available. Todo: ensures is valid
            //const mqtt_protocol_name = Object.keys(info.protocols)[0]
            //const mqtt_protocol = info.protocols[mqtt_protocol_name]

            // sign the certificate
            const crt: CrtData = await this.axios.doPairing(csr.csr);

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
            console.log("error initing", err);
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
                l.error("Error initing: ", err);
                this.initPending = null;
                const randomRetry = 5 + 10 * Math.random();
                l.warn(`Retry init in  ${randomRetry} secs`);

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

    private recurseNotifyObject = (prefix: string, rootValue: Record<string, any>, ts: number) => {
        _.mapKeys(rootValue, (value, key) => {
            const decoratedName = `${prefix}${key}`;
            if (_.isArray(value) && value.length > 0 && !_.isObject(value[0])) {
                for (const e in value as Array<any>) {
                    this.recurseNotifyObject(`${decoratedName}[${e}]`, value[e], ts);
                }
            } else if (_.isObject(value)) {
                this.recurseNotifyObject(decoratedName + ".", value, ts);
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
            super.notifyTag(decoratedName, new State(value, ts));
        });
        if (prefix.length > 0) {
            super.notifyTag(prefix.slice(0, -1), new State(rootValue, ts));
        }
    };

    /**
     *
     * @param dataPoints
     * @returns
     */
    async post(dataPoints: Array<DataPoint>): Promise<boolean> {
        if (!this.readyToTransmit) {
            l.log(`Cannot process ${JSON.stringify(dataPoints)}. Device not ready to transmit!`);
            return false;
        }
        if (!this._config) {
            l.log(`Cannot process ${JSON.stringify(dataPoints)}. Device is not configured yet!`);
            return false;
        }
        for (const dp of dataPoints) {
            if (dp.tagName == undefined) {
                assert(_.isObject(dp.value));
                this.recurseNotifyObject("", dp.value, dp.timestamp);
            } else {
                // else notify single components
                if (_.isObject(dp.value)) {
                    this.recurseNotifyObject(dp.tagName + ".", dp.value, dp.timestamp);
                } else {
                    // try to notify whole object
                    super.notifyTag(dp.tagName as string, new State(dp.value, dp.timestamp));
                }
            }
        }

        return true;
    }

    async postAlarm(alarmData: AlarmData): Promise<boolean> {
        const payload = this.serializeMessage({ t: Date.now(), v: alarmData });
        l.debug("Going to send alarm ", { t: Date.now(), v: alarmData } /*, payload */);
        await this.mqttClient.publish(
            `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.pub.DeviceAlarm/a`,
            payload,
        );
        return true;
    }
}
