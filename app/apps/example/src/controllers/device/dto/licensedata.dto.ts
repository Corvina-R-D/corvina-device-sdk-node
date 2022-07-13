import { LicenseData } from "@corvina/corvina-device-sdk";

export class LicenseDataDTO implements LicenseData {
    realm: string;
    logicalId: string;
    apiKey: string;
    platformPairingApiUrl: string;
    brokerUrls: string[];
}
