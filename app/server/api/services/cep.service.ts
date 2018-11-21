import L from '../../common/logger'
import pem from 'pem'
import LicensesAxiosInstance , {LicenseData, ProtocolData, CrtData} from './licensesaxiosinstance'
import { resolve } from 'bluebird';
import mqtt , {IClientOptions, ISecureClientOptions, MqttClient} from 'mqtt';
var assert = require('assert');

interface CSRData {
    csr : string;
    clientKey : string;
}

export class CEPService {

    private inited: boolean;
    private initPending: Promise<boolean>;
    private licenseData : LicenseData;
    private mqttClient : MqttClient;

    constructor() {
        this.inited = false;
        this.initPending = null;
        this.licenseData = {} as LicenseData;
        this.init();
    }

    private createCSR(logicalId: string) : Promise<CSRData> {
        return new Promise( (resolve, reject) => {
            pem.createCSR( { organization: "System", commonName: `${this.licenseData.logicalId}`}, (err, obj) => {
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

    private connectClient(broker_url: string, key: string, crt: string) : Promise<any> {
        return new Promise( (resolve, reject) => {
            let mqttClientOptions : ISecureClientOptions = {}
            mqttClientOptions.rejectUnauthorized = false;
            mqttClientOptions.key = key;
            mqttClientOptions.cert = crt;
            this.mqttClient = mqtt.connect(broker_url, mqttClientOptions)

            this.mqttClient.on('connect', function () {
                console.log("Successfully connected to mqtt brokern!")
                resolve(true);
            })

            this.mqttClient.on('error', (error) => {
                reject(error);
                console.warn(error)} 
            )
        })
    }

    async _asyncInit() : Promise<boolean> {
        console.log("async init")
        try {
            this.licenseData = await LicensesAxiosInstance.init();
            console.log("got api key " , this.licenseData)
            this.inited = true;

            /* Below steps should be cached to disk */

            // create identity
            const csr : CSRData = await this.createCSR(this.licenseData.logicalId);

            // check connection info
            const info : ProtocolData = await LicensesAxiosInstance.getInfo(this.licenseData.platformPairingApiUrl, this.licenseData.apiKey, this.licenseData.logicalId)

            // is astarte_mqtt_v1 available??
            const mqtt_protocol = info.protocols["astarte_mqtt_v1"]
            assert(mqtt_protocol)

            // sign the certificate
            const crt : CrtData = await LicensesAxiosInstance.doPairing(this.licenseData.platformPairingApiUrl, this.licenseData.apiKey, csr.csr);
            console.log(crt)

            // verify the certificate
            assert( await LicensesAxiosInstance.verify(crt.client_crt) );

            /* ************************************* */

            // connect mqtt
            await this.connectClient(mqtt_protocol.broker_url, csr.clientKey, crt.client_crt);

        } catch(err) {
            console.warn(err)
            this.inited = false;
            throw(err)
        }
        return this.inited;
    }

    async init() : Promise<boolean> {
        if (this.inited == false && this.initPending == null) {
            // do the async call
            this.initPending = this._asyncInit();
            await this.initPending;
        }
        return this.inited;
    }

    async post(name: string): Promise<void> {
        //await this.init();
        L.info(`create example with name `, this.licenseData);
        return Promise.resolve();
    }
}

export default new CEPService();
