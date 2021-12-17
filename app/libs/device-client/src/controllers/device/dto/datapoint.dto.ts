import { DataPoint } from "../../../common/types";

export class DataPointDTO implements DataPoint {
    tagName: string; // tag name
    value: any;
    timestamp: number; // posix time
}
