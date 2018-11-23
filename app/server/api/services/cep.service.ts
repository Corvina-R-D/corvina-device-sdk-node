import L from '../../common/logger'
import pem from 'pem'
import LicensesAxiosInstance, { LicenseData, ProtocolData, CrtData } from './licensesaxiosinstance'
import { resolve, reject } from 'bluebird';
import mqtt, { IClientOptions, ISecureClientOptions, MqttClient } from 'mqtt';
import BSON from 'bson'
import { timingSafeEqual } from 'crypto';
var assert = require('assert');
import tls, { ConnectionOptions, connect } from 'tls';
import { exec } from 'child_process'
import URL from 'url';
import { hostname } from 'os';

interface CSRData {
    csr: string;
    clientKey: string;
}

export interface DataPoint {
    tagName: string; // tag name
    value: any;
    timestamp: number; // posix time
}

export class CEPService {

    private inited: boolean;
    private initPending: Promise<boolean>;
    private licenseData: LicenseData;
    private mqttClient: MqttClient;

    private empyCacheTopic: string;
    private introspectionTopic: string;
    // publish introspection (required interfaces)
    private static baseIntrospection: string = "com.corvina.control.sub.Config:0:2;com.corvina.control.pub.Config:0:2";
    private customIntrospections: string;
    private applyConfigTopic: string;
    private configTopic: string;

    private lastConfig: string;

    private tagToTopicMap: Map<string, string>;


    constructor() {
        this.inited = false;
        this.initPending = null;
        this.licenseData = {} as LicenseData;
        this.customIntrospections = "";
        this.lastConfig = "";
        this.init();
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
        this.tagToTopicMap = new Map<string, string>();
        this.customIntrospections = ""
        console.log("APPLY CONFIG: ", JSON.stringify(config))

        // FIXME: support hierarchical models!!
        assert(config.type == "datamodel")
        for (let n in config.properties) {
            const nodeInterfaces = config.properties[n].interfaces
            console.log(nodeInterfaces)
            for (let i of nodeInterfaces) {
                console.log(i)
                this.customIntrospections += `;${i.interface_name}:${i.version_major}:${i.version_minor}`

            }
            const nodeProperties = config.properties[n].properties
            for (let p in nodeProperties) {
                const prop = nodeProperties[p]
                const dl = prop.datalink;
                const map = prop.mapping;
                this.tagToTopicMap.set(dl.source, `${this.licenseData.realm}/${this.licenseData.logicalId}${map.device_endpoint}`);
            }
        }

        this.publish(this.configTopic, JSON.stringify({ v: JSON.stringify(config), t: Date.now() }));

        console.log("done !")

        this.lastConfig = config;
        setTimeout(() => {
            this.inited = false;
            this.mqttClient.end();
            this.init();
        }, 1000);
    }

    private connectClient(broker_url: string, key: string, crt: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let mqttClientOptions: ISecureClientOptions = {}
            mqttClientOptions.rejectUnauthorized = false;
            mqttClientOptions.key = key;
            mqttClientOptions.cert = crt;
            this.mqttClient = mqtt.connect(broker_url, mqttClientOptions)

            this.subscribeChannel(this.applyConfigTopic);

            this.mqttClient.on('connect', (v) => {
                console.log("Successfully connected to mqtt brokern!", v)

                console.log("published introspection " + CEPService.baseIntrospection + this.customIntrospections)
                this.publish(this.introspectionTopic, CEPService.baseIntrospection + this.customIntrospections);
                // Empty properties cache
                console.log("published empty cache")
                this.publish(this.empyCacheTopic, '1');


                resolve(true);
            })

            this.mqttClient.on('close', (v) => {
                console.log("STREAM CLOSED!", v)
            })

            this.mqttClient.on('reconnect', (v) => {
                console.log("STREAM RECONNECTED!", v)
            })

            this.mqttClient.on('error', (error) => {
                console.warn("STREAM ERROR!", error)
                reject(error);
            }
            )


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

    private publish(channel: string, message: string): Promise<any> {
        console.log("GOING TO PUBLISH ", channel, message)
        return new Promise((resolve, reject) => {
            this.mqttClient.publish(channel, message, (err) => {
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
            this.licenseData = await LicensesAxiosInstance.init();
            console.log("Got api key ", this.licenseData)
            this.inited = true;

            /* Below steps should be cached to disk */

            // create identity
            const csr: CSRData = await this.createCSR(this.licenseData.logicalId);

            // check connection info
            const info: ProtocolData = await LicensesAxiosInstance.getInfo(this.licenseData.platformPairingApiUrl, this.licenseData.apiKey, this.licenseData.logicalId)

            // is astarte_mqtt_v1 available??
            const mqtt_protocol = info.protocols["astarte_mqtt_v1"]
            assert(mqtt_protocol)

            // sign the certificate
            const crt: CrtData = await LicensesAxiosInstance.doPairing(this.licenseData.platformPairingApiUrl, this.licenseData.apiKey, csr.csr);
            console.log(crt)

            // verify the certificate
            assert(await LicensesAxiosInstance.verify(crt.client_crt));

            /* ************************************* */

            // Get broker cert
            const brokerUrl = URL.parse(mqtt_protocol.broker_url)



            this.empyCacheTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/control/emptyCache`;
            this.introspectionTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}`;
            this.applyConfigTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.sub.Config/applyConfiguration`;
            this.configTopic = `${this.licenseData.realm}/${this.licenseData.logicalId}/com.corvina.control.pub.Config/configuration`;

            // connect mqtt
            await this.connectClient(mqtt_protocol.broker_url, csr.clientKey, crt.client_crt);
            //await this.retrieveServerCert(URL.parse(mqtt_protocol.broker_url).host);


        } catch (err) {
            console.warn(err)
            this.inited = false;
            throw (err)
        }

        return this.inited;
    }

    async init(): Promise<boolean> {
        if (this.inited == false && this.initPending == null) {
            try {
	        // do the async call
                this.initPending = this._asyncInit();
                await this.initPending;
                this.initPending = null;
            } catch(err) {
                this.inited = false;
                this.initPending = null;
            }
        }
        return this.inited;
    }

    async post(dataPoints: Array<DataPoint>): Promise<void> {
        await this.init();
        for (let dp of dataPoints) {
            const topic = this.tagToTopicMap.get(dp.tagName)
            if (!topic) {
                console.error(`Unknown topic for tag ${dp.tagName}`);
            } else {
                const payload = JSON.stringify({ v: dp.value, t: Date.now() })
                console.log("GOING TO SEND TO TOPIC", topic, payload)
                await this.mqttClient.publish(topic, payload)
            }
        }
        return Promise.resolve();
    }
}

export default new CEPService();
