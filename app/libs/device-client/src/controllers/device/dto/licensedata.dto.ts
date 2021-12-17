import { LicenseData } from "../../../services/licensesaxiosinstance";

export class LicenseDataDTO implements LicenseData {
    realm: string;
    logicalId: string;
    apiKey: string;
    platformPairingApiUrl: string;
    brokerUrls: string[];
}
