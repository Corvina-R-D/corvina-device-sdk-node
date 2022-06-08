import { LicenseData } from "../../../../../../libs/device-client/src/services/licensesaxiosinstance";

export class LicenseDataDTO implements LicenseData {
    realm: string;
    logicalId: string;
    apiKey: string;
    platformPairingApiUrl: string;
    brokerUrls: string[];
}
