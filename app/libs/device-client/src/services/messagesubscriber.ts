/*! Publish data according to new data and installed policies */
export class MessageSubscriber {
    private _topic: string;
    private _tagName: string;
    private _fieldName: string;
    private _topicType: string;

    constructor({
        topic,
        tagName,
        topicType,
        fieldName,
    }: {
        topic: string;
        tagName: string;
        topicType: string;
        fieldName?: string;
    }) {
        this._topic = topic;
        this._tagName = tagName;
        this._topicType = topicType;
        this._fieldName = fieldName;
    }

    get topic(): string {
        return this._topic;
    }

    get topicType(): string {
        return this._topicType;
    }

    get tagName(): string {
        return this._tagName;
    }

    get fieldName(): string {
        return this._fieldName;
    }

    toString(): string {
        return `MessageSubscriber@${this._topic} => ${this._tagName}${
            this._fieldName ? "." + this._fieldName : ""
        }`;
    }
}
