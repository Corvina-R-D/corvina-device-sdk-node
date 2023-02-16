/*! Publish data according to new data and installed policies */
export class MessageSubscriber {
    private _topic: string;
    private _modelPath: string;
    private _topicType: string;
    private _fieldName: string;
    private _targetTag: string;

    constructor({
        topic,
        modelPath,
        topicType,
        fieldName,
        targetTag,
    }: {
        topic: string;
        modelPath: string;
        topicType: string;
        fieldName?: string;
        targetTag: string;
    }) {
        this._topic = topic;
        this._modelPath = modelPath;
        this._topicType = topicType;
        this._fieldName = fieldName;
        this._targetTag = targetTag;
    }

    get topic(): string {
        return this._topic;
    }

    get topicType(): string {
        return this._topicType;
    }

    get modelPath(): string {
        return this._modelPath;
    }

    get fieldName(): string {
        return this._fieldName;
    }

    get targetTag(): string {
        return this._targetTag;
    }

    toString(): string {
        return `MessageSubscriber@${this._topic} => ${this._modelPath}${this._fieldName ? "." + this._fieldName : ""}`;
    }
}
