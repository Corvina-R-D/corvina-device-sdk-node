import L from '../../common/logger'
import pem from 'pem'
import LicensesAxiosInstance, { LicenseData, ProtocolData, CrtData } from './licensesaxiosinstance'
import mqtt, { IClientOptions, ISecureClientOptions, MqttClient } from 'mqtt';
import BSON from 'bson'
var assert = require('assert');
import { exec } from 'child_process'
import URL from 'url';

import fs, { readSync } from 'fs'
import path from 'path'

interface CSRData {
    csr: string;
    clientKey: string;
}

import { DataSimulator, SimulationDesc } from './simulation'

export interface TagDesc {
    name: string,
    type: string,
    simulation: SimulationDesc
}

enum PacketFormatEnum {
    JSON = "json",
    BSON = "bson"
}

export interface DeviceConfig {
    activationKey?: string;
    pairingEndpoint?: string;
    availableTags?: Array<TagDesc>; // json array string 
    simulateTags?: boolean;
    packetFormat?: PacketFormatEnum;
}

export interface DataPoint {
    tagName: string; // tag name
    value: any;
    timestamp: number; // posix time
}

export class DeviceService {

    private inited: boolean;
    private initPending: Promise<boolean>;
    private readyToTransmit: boolean;
    private licenseData: LicenseData;
    private mqttClient: MqttClient;

    private empyCacheTopic: string;
    private introspectionTopic: string;
    // publish introspection (required interfaces)
    private static baseIntrospection: string = "com.corvina.control.sub.Config:0:2;com.corvina.control.pub.Config:0:2";
    private customIntrospections: string;
    private applyConfigTopic: string;
    private configTopic: string;
    private availableTagsTopic: string;

    private lastConfig: string;

    private tagToTopicMap: Map<string, string>;

    private deviceConfig: DeviceConfig;
    private axios: LicensesAxiosInstance;


    constructor() {
        this.deviceConfig = {}
        this.reinit(
            {
                activationKey: process.env.ACTIVATION_KEY,
                pairingEndpoint: process.env.PAIRING_ENDPOINT,
                availableTags: (() => { try { return JSON.parse(process.env.AVAILABLE_TAGS) } catch (err) { return [] } })(),
                simulateTags: !!(() => { try { return JSON.parse(process.env.SIMULATE_TAGS) } catch (err) { return [] } })(),
                packetFormat: process.env.PACKET_FORMAT as PacketFormatEnum
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
AVAILABLE_TAGS=${JSON.stringify(this.deviceConfig.availableTags)}
SIMULATE_TAGS=${this.deviceConfig.simulateTags}
PACKET_FORMAT=${this.deviceConfig.packetFormat}`
        }
        fs.writeFileSync(envFile, currentContent)
        return this.deviceConfig
    }

    public ready() {
        return this.inited;
    }

    private retrieveServerCert(host: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const cmd = `openssl s_client -connect ${host}`
            console.log(cmd)
            exec(cmd, function callback(error, stdout, stderr) {
                console.log(stdout.match(/^.*(-----BEGIN[\s\S]*?-----END CERTIFICATE-----).*$/m)[0].replace(/\n/g, '\\n'))
                resolve(error)
                // result
            });
            /* let opts = {  key: key, cert: cert, port: port, host: host, hostname: host, rejectUnauthorized: false, 
                checkServerIdentity:  (h, c) : Error | undefined  => { 
                    console.log("checkServerIdentity called ", c.raw.toString())
                    //resolve(c)
                    return undefined;
                }
            }
            let connection = tls.connect( opts as ConnectionOptions)
            connection.on('error', (reason) => {
                console.error(reason);
                //reject(reason)
            }) */
        })
    }

    private createCSR(logicalId: string): Promise<CSRData> {
        return new Promise((resolve, reject) => {
            pem.createCSR({ organization: "System", commonName: `${this.licenseData.logicalId}` }, (err, obj) => {
                if (err == null) {
                    console.log("PEM RETURNED", err, obj)
                    resolve(obj);
                } else {
                    reject(err);
                }
            }
            )
        })
    }

    private applyConfig(config: any) {
        if (JSON.stringify(config) == JSON.stringify(this.lastConfig)) {
            console.log("Found same config => return");
            return;
        }
        this.readyToTransmit = false;

        this.tagToTopicMap = new Map<string, string>();
        this.customIntrospections = ""
        console.log("APPLY CONFIG: ", JSON.stringify(config))

        assert(config.type == "datamodel")
        for (let n in config.properties) {
            const nodeInterfaces = config.properties[n].interfaces
            console.log(nodeInterfaces)
            for (let i of nodeInterfaces) {
                console.log(i)
                this.customIntrospections += `;${i.interface_name}:${i.version_major}:${i.version_minor}`

            }
            let nodeProperties: Array<any> = []
            Object.keys(config.properties[n].properties).forEach((k) => { nodeProperties.push(config.properties[n].properties[k]); })
            for (let prop of nodeProperties) {
                const dl = prop.datalink;
                const map = prop.mapping;
                if (dl && map) {
                    this.tagToTopicMap.set(dl.source, `${this.licenseData.realm}/${this.licenseData.logicalId}${map.device_endpoint}`);
                }
                // if (prop.type == "object") {
                //     nodeProperties = nodeProperties.concat( Object.keys(prop.properties).forEach( (k) => { nodeProperties.push( prop.properties[k] ); } ) )
                // } else if (prop.type == 'array') {
                //     nodeProperties = nodeProperties.concat( prop.item )
                // }
                if (prop.type == "object") {
                    Object.keys(prop.properties).forEach((k) => { nodeProperties.push(prop.properties[k]); })
                } else if (prop.type == 'array') {
                    nodeProperties.push(prop.item)
                }
                // FIXME: support struct and array models!!
            }
        }

        console.log("done !")

        this.lastConfig = config;
        setTimeout(async () => {
            // wait if an init process is ongoing
            if (this.initPending) {
                await this.initPending
            }
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
            let mqttClientOptions: ISecureClientOptions = {}
            mqttClientOptions.rejectUnauthorized = false;
            mqttClientOptions.key = key;
            mqttClientOptions.cert = crt;
            this.mqttClient = mqtt.connect(broker_url, mqttClientOptions)

            this.subscribeChannel(this.applyConfigTopic);

            this.mqttClient.on('connect', async (v) => {
                console.log("Successfully connected to mqtt brokern!", v)

                console.log("published introspection " + DeviceService.baseIntrospection + this.customIntrospections)
                await this.publish(this.introspectionTopic, DeviceService.baseIntrospection + this.customIntrospections, { qos: 2 });
                // Empty properties cache
                console.log("published empty cache")
                await this.publish(this.empyCacheTopic, '1', { qos: 2 });

                console.log(JSON.stringify({ v: JSON.stringify(this.deviceConfig.availableTags), t: Date.now() }))
                await this.publish(this.availableTagsTopic, this.serializeMessage({ v: JSON.stringify(this.deviceConfig.availableTags), t: Date.now() }), { qos: 2 })

                console.log("published configuration")
                await this.publish(this.configTopic, this.serializeMessage({ v: JSON.stringify(this.lastConfig), t: Date.now() }), { qos: 2 });


                this.readyToTransmit = true;
                console.log("Ready to transmit!")

                DataSimulator.clear();
                if (this.deviceConfig.simulateTags) {
                    this.deviceConfig.availableTags.forEach(
                        (value) => { new DataSimulator(value.name, value.type, async (t, v, ts) => { if (this.ready()) { return this.post([{ tagName: t, value: v, timestamp: ts }]);  } return false;  } , value.simulation) }
                    )
                }
        
                resolve(true);
            })

            this.mqttClient.on('close', (v) => {
                DataSimulator.clear();
                console.log("STREAM CLOSED!", v)
            })

            this.mqttClient.on('reconnect', (v) => {
                DataSimulator.clear();
                console.log("STREAM RECONNECTED!", v)
            })

            this.mqttClient.on('error', (error) => {
                console.warn("STREAM ERROR!", error)
                reject(error);
            })


            this.mqttClient.on('message', (topic, message) => {
                console.log(`\nReceived message on ${topic} \n`)
                switch (topic) {
                    case this.applyConfigTopic.toString():
                        this.applyConfig(JSON.parse(BSON.deserialize(message).v))
                        break;
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
                    console.warn(`Error subscribing ${channel}: `, err)
                    reject(err);
                }
            })
        })
    }

    private publish(channel: string, message: string, options: any = {}): Promise<any> {
        console.log("GOING TO PUBLISH ", channel, message)
        return new Promise((resolve, reject) => {
            this.mqttClient.publish(channel, message, options, (err) => {
                if (!err) {
                    resolve(true);
                } else {
                    console.warn(`Error publishing to ${channel}: `, err)
                    reject(err);
                }
            })
        })
    }



    async _asyncInit(): Promise<boolean> {
        try {
            this.licenseData = await this.axios.init();
            console.log("Got api key ", this.licenseData)
            this.inited = true;

            /* Below steps should be cached to disk */

            // create identity
            const csr: CSRData = await this.createCSR(this.licenseData.logicalId);

            // check connection info
            const info: ProtocolData = await this.axios.getInfo(this.licenseData.platformPairingApiUrl, this.licenseData.apiKey, this.licenseData.logicalId)

            // take first protocol available. Todo: ensures is valid
            const mqtt_protocol = info.protocols[Object.keys(info.protocols)[0]]
            assert(mqtt_protocol)

            // sign the certificate
            const crt: CrtData = await this.axios.doPairing(this.licenseData.platformPairingApiUrl, this.licenseData.apiKey, csr.csr);
            console.log(crt)

            // verify the certificate
            assert(await this.axios.verify(crt.client_crt));

            /* ************************************* */

            // Get broker cert
            const brokerUrl = URL.parse(mqtt_protocol.broker_url)



            this.empyCacheTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/control/emptyCache`;
            this.introspectionTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}`;
            this.applyConfigTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.sub.Config/applyConfiguration`;
            this.configTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.pub.Config/configuration`;
            this.availableTagsTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.pub.Config/availableTags`;

            // connect mqtt
            await this.connectClient(mqtt_protocol.broker_url, csr.clientKey, crt.client_crt);
            //await this.retrieveServerCert(URL.parse(mqtt_protocol.broker_url).host);


        } catch (err) {
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
                console.error("Error initing: ", err);
                this.initPending = null;
                let randomRetry = 5 + 10 * Math.random()
                console.error(`Retry init in  ${randomRetry} secs`);
                setTimeout(() => { this.init() }, randomRetry * 1000)
            }
            this.initPending = null;
        }
        return this.inited;
    }

    async post(dataPoints: Array<DataPoint>): Promise<boolean> {
        if (!this.readyToTransmit) {
            console.error(`Cannot process ${JSON.stringify(dataPoints)}. Device not ready to transmit!`)
            return false;
        }
        if (!this.tagToTopicMap) {
            console.error(`Cannot process ${JSON.stringify(dataPoints)}. Device is not configured yet!`)
            return false;
        }
        for (let dp of dataPoints) {
            const topic = this.tagToTopicMap.get(dp.tagName)
            if (!topic) {
                console.error(`Unknown topic for tag ${dp.tagName}`);
                return false;
            } else {
                const payload = this.serializeMessage({ v: dp.value, t: Date.now() })
                console.log("GOING TO SEND TO TOPIC", /* this.tagToTopicMap, */ topic, payload)
                try { 
                    await this.mqttClient.publish(topic, payload)
                } catch(e) {
                    return false;
                }
            }
        }
        return true;
    }
}

export default new DeviceService();
