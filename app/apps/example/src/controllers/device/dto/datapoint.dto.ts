import { DataPoint } from "@corvina/device-client";

export class DataPointDTO implements DataPoint {
    tagName: string; // tag name
    value: any;
    timestamp: number; // posix time
}
