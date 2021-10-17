import l from '../../common/logger'
import pem from 'pem'
import LicensesAxiosInstance, { LicenseData, CrtData } from './licensesaxiosinstance'
import mqtt, { IClientOptions, MqttClient } from 'mqtt';
import BSON from 'bson'
import _ from 'lodash'
var assert = require('assert');

import fs from 'fs'
import path from 'path'

var x509 = require('x509.js');

interface CSRData {
    csr: string;
    clientKey: string;
}

import { DataSimulator, AlarmSimulator, BaseSimulator } from './simulation'
import { TagDesc, AlarmDesc, DataPoint, AlarmData, AlarmCommand} from './commontypes'

enum PacketFormatEnum {
    JSON = "json",
    BSON = "bson"
}

export interface DeviceConfig {
    activationKey?: string;
    pairingEndpoint?: string;
    availableTagsFile?: string; // json array string 
    availableTags?: Array<TagDesc>; // json array string 
    simulateTags?: boolean;
    availableAlarms?: Array<AlarmDesc>; // json array string 
    simulateAlarms?: boolean;
    packetFormat?: PacketFormatEnum;
}



/**
 * @class DeviceService 
 * @summary Implements a Corvina virtual device
 * @description Implements a Corvina virtual device receiving the configuration from the cloud and providing tag and alarm simulation.
 */

type TagSource = string;
type TagTopic = string;
type TagTopicType = string;

interface TagTopicDetails {
    tagTopic: TagTopic;
    tagTopicType: TagTopicType;
    propType: TagTopicType; 
}

export class DeviceService {

    private inited: boolean;
    private initPending: Promise<boolean>;
    private readyToTransmit: boolean;
    private licenseData: LicenseData;
    private mqttClient: MqttClient;
    
    private msgSentStats: number = 0;
    private byteSentStats: number = 0;
    private lastDateStats: number = Date.now()

    // If there are multiple endpoint options and one fails, this index is incremented to try the next broker url option
    private lastTriedBrokerEndpoint: number = 0;

    private empyCacheTopic: string;
    private introspectionTopic: string;
    // publish introspection (required interfaces)
    private static baseIntrospection: string = "com.corvina.control.sub.Config:0:2;com.corvina.control.pub.Config:0:2;com.corvina.control.pub.DeviceAlarm:2:0;com.corvina.control.sub.DeviceAlarm:1:0";
    private customIntrospections: string;
    private applyConfigTopic: string;
    private consumerPropertiesTopic: string;
    private actionAlarmTopic: string;
    private configTopic: string;
    private availableTagsTopic: string;

    private lastConfig: string;


    private tagToTopicMap: Map<TagSource, TagTopicDetails [] >;

    private deviceConfig: DeviceConfig;
    private axios: LicensesAxiosInstance;


    constructor() {
        this.deviceConfig = {}
        const availableTagsFile =  process.env.AVAILABLE_TAGS_FILE || "";
        this.reinit(
            {
                activationKey: process.env.ACTIVATION_KEY,
                pairingEndpoint: process.env.PAIRING_ENDPOINT,
                availableTagsFile: availableTagsFile,
                availableTags: (() => { 
                    try { 
                            if (availableTagsFile.length) {
                                return JSON.parse(fs.readFileSync(availableTagsFile).toString())
                            }        
                            return JSON.parse(process.env.AVAILABLE_TAGS) 
                        } catch (err) { 
                            return [] } 
                    })(),
                simulateTags: !!(() => { try { return JSON.parse(process.env.SIMULATE_TAGS) } catch (err) { return false } })(),
                availableAlarms: (() => { try { return JSON.parse(process.env.AVAILABLE_ALARMS) } catch (err) { return [] } })(),
                simulateAlarms: !!(() => { try { return JSON.parse(process.env.SIMULATE_ALARMS) } catch (err) { return false } })(),
                packetFormat: process.env.PACKET_FORMAT as PacketFormatEnum || PacketFormatEnum.BSON
            }, true)
    }

    getAppliedConfig() {
        return this.lastConfig
    }

    getDeviceConfig() { return this.deviceConfig }

    getLicenseData() {
        return this.licenseData
    }

    public reinit(deviceConfig: DeviceConfig, doInit = false): DeviceConfig {
        this.inited = false;
        this.readyToTransmit = false;
        this.tagToTopicMap = null;
        if (this.mqttClient) {
            this.mqttClient.end();
            this.mqttClient = null
        }
        DataSimulator.clear();
        this.initPending = null;
        this.licenseData = {} as LicenseData;
        this.customIntrospections = "";
        this.lastConfig = "";
        Object.assign(this.deviceConfig, deviceConfig)
        this.axios = new LicensesAxiosInstance(this.deviceConfig.pairingEndpoint, this.deviceConfig.activationKey)
        this.init();
        let envFile = path.join(process.cwd(), '.env')
        let currentContent = fs.readFileSync(envFile).toString()
        let appendedValuesPos = currentContent.indexOf("### LAST-ENV ###")
        if (appendedValuesPos > 0) {
            currentContent = currentContent.slice(0, appendedValuesPos)
            currentContent += `
### LAST-ENV ###
# don't write below this line!!
ACTIVATION_KEY=${this.deviceConfig.activationKey}
PAIRING_ENDPOINT=${this.deviceConfig.pairingEndpoint}
AVAILABLE_TAGS_FILE=${this.deviceConfig.availableTagsFile || ""}
AVAILABLE_TAGS=${ ( ! this.deviceConfig.availableTagsFile || this.deviceConfig.availableTagsFile.length == 0 ) ? JSON.stringify(this.deviceConfig.availableTags) : ''}
SIMULATE_TAGS=${this.deviceConfig.simulateTags ? 1 : 0}
AVAILABLE_ALARMS=${JSON.stringify(this.deviceConfig.availableAlarms)}
SIMULATE_ALARMS=${this.deviceConfig.simulateAlarms ? 1 : 0}
PACKET_FORMAT=${this.deviceConfig.packetFormat}`
        }
        fs.writeFileSync(envFile, currentContent)
        return this.deviceConfig
    }

    public ready() {
        return this.inited;
    }

    private createCSR(logicalId: string): Promise<CSRData> {
        return new Promise((resolve, reject) => {
            pem.createCSR({ organization: "System", commonName: `${this.licenseData.logicalId}` }, (err, obj) => {
                if (err == null) {
                    l.debug("PEM RETURNED", err, obj)
                    resolve(obj);
                } else {
                    reject(err);
                }
            }
            )
        })
    }

    private async applyConfig(config: any) {
        if (JSON.stringify(config) == JSON.stringify(this.lastConfig)) {
            l.info("Found same config => return");
            return;
        }

        if (this.initPending) {
            await this.initPending
        }

        this.readyToTransmit = false;

        this.tagToTopicMap = new Map<TagSource, TagTopicDetails []>();
        this.customIntrospections = ""
        l.debug("Apply config: ", JSON.stringify(config))

        assert(config.type == "datamodel")
        for (let n in config.properties) {
            const nodeInterfaces = config.properties[n].interfaces
            for (let i of nodeInterfaces) {
                this.customIntrospections += `;${i.interface_name}:${i.version_major}:${i.version_minor}`
            }
            let nodeProperties: Array<any> = []
            Object.keys(config.properties[n].properties).forEach((k) => { nodeProperties.push(config.properties[n].properties[k]); })
            for (let prop of nodeProperties) {
                const dl = prop.datalink;   
                const map = prop.mapping;
                if (dl && map) {
                    if (prop.parentStruct) {
                        // is a property of a struct
                        this.tagToTopicMap.set(dl.source, (this.tagToTopicMap.get(dl.source) || []).concat( [ {tagTopic: `${this.licenseData.realm}/${this.licenseData.logicalId}${map.device_endpoint.slice(0,map.device_endpoint.lastIndexOf("/"))}`, tagTopicType: prop.type, propType: prop.type } ]) );
                    } else {
                        this.tagToTopicMap.set(dl.source, (this.tagToTopicMap.get(dl.source) || []).concat( [ {tagTopic: `${this.licenseData.realm}/${this.licenseData.logicalId}${map.device_endpoint}`, tagTopicType: prop.type, propType: prop.type } ]) );
                    }
                }
                if (prop.type == "object") {
                    Object.keys(prop.properties).forEach((k) => { nodeProperties.push(prop.properties[k]); })
                } else if (prop.type == 'array') {
                    nodeProperties.push(prop.item)
                } else if (prop.type == 'struct') {
                    // map single structure properties
                    Object.keys(prop.properties).forEach((k) => { 
                        const p = _.cloneDeep(prop.properties[k]) // avoid altering input structure
                        p.parentStruct = prop
                        nodeProperties.push(p); 
                    })
                }
            }
        }

        l.debug("done !")

        this.lastConfig = config;
        setTimeout(async () => {
            await this.mqttClient.end();
            await this.mqttClient.reconnect();
        }, 0);
    }

    private serializeMessage(msg: any): any {
        if (this.deviceConfig.packetFormat == PacketFormatEnum.BSON) {
            return BSON.serialize(msg)
        } else {
            return JSON.stringify(msg)
        }
    }

    private connectClient(broker_url: string, key: string, crt: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let mqttClientOptions: IClientOptions = {}
            mqttClientOptions.rejectUnauthorized = false;
            mqttClientOptions.key = key;
            mqttClientOptions.cert = crt;
            mqttClientOptions.clean = false;
            mqttClientOptions.clientId = x509.parseCert(crt).subject.commonName ;
            this.mqttClient = mqtt.connect(broker_url, mqttClientOptions)

            this.subscribeChannel(this.consumerPropertiesTopic);
            this.subscribeChannel(this.applyConfigTopic);
            this.subscribeChannel(this.actionAlarmTopic);

            this.mqttClient.on('connect', async (v) => {
                l.info("Successfully connected to mqtt broker!", v)

                l.debug("published introspection " + DeviceService.baseIntrospection + this.customIntrospections)
                await this.publish(this.introspectionTopic, DeviceService.baseIntrospection + this.customIntrospections, { qos: 2 });
                // Empty properties cache
                l.debug("published empty cache")
                await this.publish(this.empyCacheTopic, '1', { qos: 2 });

                await this.publish(this.availableTagsTopic, this.serializeMessage({ v: JSON.stringify(this.deviceConfig.availableTags), t: Date.now() }), { qos: 2 })

                l.debug("published configuration")
                await this.publish(this.configTopic, this.serializeMessage({ v: JSON.stringify(this.lastConfig), t: Date.now() }), { qos: 2 });


                this.readyToTransmit = true;
                l.info("Ready to transmit!")

                DataSimulator.clear();
                if (this.deviceConfig.simulateTags) {
                    this.deviceConfig.availableTags.forEach(
                        (value) => { 
                            new DataSimulator(value.name, value.type, 
                                async (t, v, ts) => { 
                                    if (this.ready()) { 
                                        return this.post([{ tagName: t, value: v, timestamp: ts }]);  
                                    } 
                                    return false;  
                                } , value.simulation) 
                            }
                    )
                    if (this.deviceConfig.simulateAlarms) {
                        this.deviceConfig.availableAlarms.forEach(
                            (value) => { new AlarmSimulator(value, async (data: AlarmData) => { if (this.ready()) { return this.postAlarm(data);  } return false;  } ) }
                        )
                    }
                }
        
                resolve(true);
            })

            this.mqttClient.on('close', (v) => {
                DataSimulator.clear();
                l.warn("Stream closed!", v)
            })

            this.mqttClient.on('reconnect', (v) => {
                DataSimulator.clear();
                l.warn("Stream reconnected!", v)
            })

            this.mqttClient.on('error', (error) => {
                l.error("Stream error!", error)
                this.lastTriedBrokerEndpoint++;
                reject(error);
            })


            this.mqttClient.on('message', (topic, message) => {
                l.info(`Received message on ${topic} \n`)
                switch (topic) {
                    case this.consumerPropertiesTopic.toString():
                        l.debug( "Received consumer properties!" )
                        break;
                    case this.applyConfigTopic.toString():
                        this.applyConfig(JSON.parse(BSON.deserialize(message).v))
                        break;
                    case this.actionAlarmTopic.toString():
                        //console.log( JSON.parse(BSON.deserialize(message).v) )
                        let x : AlarmCommand = BSON.deserialize(message).v;
                        let sim : AlarmSimulator = BaseSimulator.simulatorsByTagName.get(AlarmSimulator.alarmSimulatorMapkey(x.name)) as AlarmSimulator
                        if (!sim) {
                            l.error("Trying to perform action on unknown alarm ", x.name)
                        } else {
                            switch (x.command ) {
                                case "ack":
                                    sim.acknoledge(x.evTs, x.user, x.comment)
                                    break;
                                case "reset":
                                    sim.reset(x.evTs, x.user, x.comment)
                                    break;
                            } 
                        }
                        break;  
                    default:
                        l.info("Nothing to do for topic ", topic)
                }
            })

        })
    }

    private subscribeChannel(channel: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.mqttClient.subscribe(channel, function (err) {
                if (!err) {
                    resolve(true);
                } else {
                    l.warn(`Error subscribing ${channel}: `, err)
                    reject(err);
                }
            })
        })
    }

    private publish(channel: string, message: string, options: any = {}): Promise<any> {
        l.debug("Going to publish ", channel /*, message */, this.readyToTransmit)
        return new Promise((resolve, reject) => {
            this.mqttClient.publish(channel, message, options, (err) => {
                if (!err) {
                    resolve(true);
                } else {
                    l.warn(`Error publishing to ${channel}: `, err)
                    reject(err);
                }
            })
        })
    }



    async _asyncInit(): Promise<boolean> {
        try {
            this.licenseData = await this.axios.init();
            l.debug("Got api key ", this.licenseData)
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
            await this.connectClient(this.licenseData.brokerUrls[this.lastTriedBrokerEndpoint % this.licenseData.brokerUrls.length], csr.clientKey, crt.client_crt);


        } catch (err) {
            console.log("error initing", err)
            this.inited = false;
            throw (err)
        }

        return this.inited;
    }

    async init(): Promise<boolean> {
        if (this.inited == false && this.initPending == null) {
            // do the async call
            this.initPending = this._asyncInit();
            try {
                await this.initPending;
            } catch (err) {
                l.error("Error initing: ", err);
                this.initPending = null;
                let randomRetry = 5 + 10 * Math.random()
                l.warn(`Retry init in  ${randomRetry} secs`);
                setTimeout(() => { this.init() }, randomRetry * 1000)
            }
            this.initPending = null;
        }
        return this.inited;
    }

    async post(dataPoints: Array<DataPoint>): Promise<boolean> {
        if (!this.readyToTransmit) {
            l.info(`Cannot process ${JSON.stringify(dataPoints)}. Device not ready to transmit!`)
            return false;
        }
        if (!this.tagToTopicMap) {
            l.info(`Cannot process ${JSON.stringify(dataPoints)}. Device is not configured yet!`)
            return false;
        }
        for (let dp of dataPoints) {
            const topics = this.tagToTopicMap.get(dp.tagName)
            for(let topic of topics) {
                if (!topic.tagTopic) {
                    l.warn(`Unknown topic for tag ${dp.tagName}`);
                    return false;
                } else {
                    // cast to cloud types, ensuring the data in not rejected
                    switch (topic.tagTopicType) {
                        case 'integer':
                            dp.value = ~~dp.value;
                            break;
                        case 'boolean':
                            dp.value = !!dp.value;
                            break;
                        case 'string':
                            dp.value = "" + dp.value
                            break;
                        case 'double':
                            dp.value = parseFloat(dp.value)
                            break;
                        case 'struct':
                            // nothing to do: dp.value = dp.value
                            break;
                        default:
                            throw 'Unsupported data type ' + topic.tagTopicType
                            break;
                    }

                    const payload = this.serializeMessage({ v: dp.value, t: Date.now() })
                    this.byteSentStats += payload.length
                    this.msgSentStats += 1
                    let timeDiff = Date.now() - this.lastDateStats
                    if (timeDiff > 10000) {
                        this.byteSentStats = 0
                        this.msgSentStats = 0
                        this.lastDateStats = this.lastDateStats + timeDiff;
                    }
                    l.debug("Going to send to topic ", /* this.tagToTopicMap, */ topic.tagTopic /*, payload*/, this.readyToTransmit)
                    try { 
                        if (!this.readyToTransmit) {
                            l.warn("Cannot publish if not ready to transmit" , this.readyToTransmit)
                            throw "Cannot publish if not ready to transmit"
                        }
                        await this.mqttClient.publish(topic.tagTopic, payload)
                    } catch(e) {
                        l.error("Got error while publishing: ", e)
                        return false;
                    }
                }
            }
        }
        return true;
    }

    async postAlarm(alarmData: AlarmData): Promise<boolean> {
        const payload = this.serializeMessage({ t: Date.now(), v: alarmData} )
        l.debug("Going to send alarm ", { t: Date.now(), v: alarmData} /*, payload */)
        await this.mqttClient.publish(`${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.pub.DeviceAlarm/a`, payload)
        return true
    }
}

export default new DeviceService();
