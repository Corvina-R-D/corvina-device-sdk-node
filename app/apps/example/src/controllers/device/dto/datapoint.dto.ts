import { DataPoint } from "@corvina/corvina-device-sdk";

export class DataPointDTO implements DataPoint {
    tagName: string; // tag name
    value: any;
    timestamp: number; // posix time
}
