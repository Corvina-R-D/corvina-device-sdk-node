import { LicenseData } from "@corvina/device-client";

export class LicenseDataDTO implements LicenseData {
    realm: string;
    logicalId: string;
    apiKey: string;
    platformPairingApiUrl: string;
    brokerUrls: string[];
}
