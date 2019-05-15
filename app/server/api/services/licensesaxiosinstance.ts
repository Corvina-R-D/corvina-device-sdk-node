import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface LicenseData {
    realm: string,
    logicalId: string,
    apiKey: string,
    platformPairingApiUrl: string
}

export interface ProtocolData {
    version?: string,
    status?: string,
    protocols?: any
}

export interface CrtData {
    client_crt ?: string
}

interface DataPayload {
    data: any;
}

export class PairingAxiosInstance
{
    private axiosInstance : AxiosInstance = axios.create();
    private licenseData : LicenseData;

    constructor(licenseData : LicenseData) {
        this.licenseData = licenseData;
        if (!this.licenseData.platformPairingApiUrl.startsWith("http")) {
            this.licenseData.platformPairingApiUrl = "https://api.platform.corvina.cloud/pairing/v1/" + this.licenseData.platformPairingApiUrl;
        }
        this.axiosInstance.defaults.baseURL = `${this.licenseData.platformPairingApiUrl}/devices/${this.licenseData.logicalId}`;
        this.axiosInstance.defaults.headers = { Authorization : `Bearer ${this.licenseData.apiKey}`};
    }

    async getInfo() : Promise<ProtocolData> {
        return this.axiosInstance.get(``).then( (data : AxiosResponse<DataPayload> ) => {
            return data.data.data;
        })
    }

    async doPairing(csr: string) : Promise<CrtData> {
        return this.axiosInstance.post(`/protocols/astarte_mqtt_v1/credentials`, { data: { csr: csr} }).then( (data : AxiosResponse<DataPayload> ) => {
            return data.data.data;
        })
    }

    async verify(crt: string) : Promise<boolean> {
        return this.axiosInstance.post(`/protocols/astarte_mqtt_v1/credentials/verify`, { data: { client_crt: crt} }).then( (data : AxiosResponse<DataPayload> ) => {
            return true;
        })
    }
}

export class LicensesAxiosInstance
{
    private axiosInstance : AxiosInstance = axios.create();
    private axiosPairiginInstance : PairingAxiosInstance;
    private actitvationKey: string;
    private pairingEndpoint: string;

    constructor(pairingEndpoint: string, activationKey: string) {
        this.pairingEndpoint = pairingEndpoint;
        this.actitvationKey = activationKey;
        console.log("License manager pairing endpoint ", this.pairingEndpoint)
        this.axiosInstance.defaults.baseURL = this.pairingEndpoint;
    }

    async init() : Promise<LicenseData> {
        let config : AxiosRequestConfig = { params: { activationKey: this.actitvationKey, serialNumber: '' } }
        return this.axiosInstance.get('', config).then( (data : AxiosResponse<LicenseData> ) => {
            this.axiosPairiginInstance = new PairingAxiosInstance(data.data);
            return data.data;
        })
    }

    async getInfo(endpoint: string, apiKey: string, deviceId: string) : Promise<ProtocolData> {
        return this.axiosPairiginInstance.getInfo();
    }

    async doPairing(endpoint: string, apiKey: string, csr: string) : Promise<CrtData> {
        return this.axiosPairiginInstance.doPairing(csr);
    }

    async verify(crt: string) : Promise<boolean> {
        return this.axiosPairiginInstance.verify(crt);
    }

}

export default LicensesAxiosInstance;
