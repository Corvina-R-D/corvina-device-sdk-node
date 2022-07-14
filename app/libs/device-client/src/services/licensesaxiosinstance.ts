import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { l } from "./logger.service";

export interface LicenseData {
    realm: string;
    logicalId: string;
    apiKey: string;
    platformPairingApiUrl: string;
    brokerUrls: string[];
}

export interface CrtData {
    client_crt?: string;
}

interface DataPayload {
    data: any;
}

/**
 * @class LicensesAxiosInstance
 * @summary Given a valid activation code, retrieves the api key used for pairing with the cloud
 */
export class PairingAxiosInstance {
    private axiosInstance: AxiosInstance = axios.create();
    private licenseData: LicenseData;

    constructor(licenseData: LicenseData) {
        this.licenseData = licenseData;
        if (!this.licenseData.platformPairingApiUrl.startsWith("http")) {
            this.licenseData.platformPairingApiUrl =
                "https://api.platform.dev.maiaconnect.com/pairing/v1/" + this.licenseData.platformPairingApiUrl;
        }
        this.axiosInstance.defaults.baseURL = `${this.licenseData.platformPairingApiUrl}/devices/${this.licenseData.logicalId}`;
        this.axiosInstance.defaults.headers = {
            Authorization: `Bearer ${this.licenseData.apiKey}`,
        } as any;
    }

    async doPairing(protocol: string, csr: string): Promise<CrtData> {
        const req = this.axiosInstance
            .post(`/protocols/${protocol}/credentials`, { data: { csr: csr } })
            .then((data: AxiosResponse<DataPayload>) => {
                return data.data.data;
            });
        return req;
    }

    async verify(protocol: string, crt: string): Promise<boolean> {
        return this.axiosInstance
            .post(`/protocols/${protocol}/credentials/verify`, {
                data: { client_crt: crt },
            })
            .then((data: AxiosResponse<DataPayload>) => {
                return true;
            });
    }
}

/**
 * @class LicensesAxiosInstance
 * @summary Given a valid activation code, retrieves the api key used for pairing with the cloud
 */
export class LicensesAxiosInstance {
    private axiosInstance: AxiosInstance = axios.create();
    private axiosPairiginInstance: PairingAxiosInstance;
    private actitvationKey: string;
    private pairingEndpoint: string;
    /** The communication protocol used by the device. Actually only corvina_mqtt_v1 */
    private static protocol = "corvina_mqtt_v1";

    constructor(pairingEndpoint: string, activationKey: string) {
        this.pairingEndpoint = pairingEndpoint;
        this.actitvationKey = activationKey;
        l.info(`License manager pairing endpoint ${this.pairingEndpoint}`);
        this.axiosInstance.defaults.baseURL = this.pairingEndpoint;
    }

    async init(): Promise<LicenseData> {
        const config: AxiosRequestConfig = {
            params: { activationKey: this.actitvationKey, serialNumber: "" },
        };
        return this.axiosInstance.get("", config).then((data: AxiosResponse<LicenseData>) => {
            this.axiosPairiginInstance = new PairingAxiosInstance(data.data);
            // split broker urls csv list into an array, filtering the required corvina_mqtt_v1 protocol and replacing it with mqtts
            if (data.data.brokerUrls) {
                data.data.brokerUrls = (data.data.brokerUrls as any as string)
                    .split(",")
                    .filter((u) => u.startsWith(LicensesAxiosInstance.protocol))
                    .map((u) => u.replace(LicensesAxiosInstance.protocol, "mqtts"));
            }
            return data.data;
        });
    }

    async doPairing(csr: string): Promise<CrtData> {
        return this.axiosPairiginInstance.doPairing(LicensesAxiosInstance.protocol, csr);
    }

    async verify(crt: string): Promise<boolean> {
        return this.axiosPairiginInstance.verify(LicensesAxiosInstance.protocol, crt);
    }
}

export default LicensesAxiosInstance;
