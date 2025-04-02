import { createBrotliCompress } from "zlib";
import { castCorvinaType } from "../common/types";
import { PostCallback } from "./corvinadatainterface";
import { MessagePublisherPolicy, State, StateTS } from "./messagepublisherpolicies";
import { InternalMessageSenderOptions, MessageSender, MessageSenderOptions } from "./messagesender";

/*! Publish data according to new data and installed policies */
export class MessagePublisher {
    protected _topic: string;
    protected _topicType: string;
    protected _tagName: string;
    protected _modelPath: string;
    protected _nextTime: StateTS;
    protected _policy: MessagePublisherPolicy;
    protected _armed: boolean;
    protected _stateToPublish: State;

    protected _lastStateVersion = 0;
    protected _lastPublishedStateVersion = 0;
    private _messageSender: MessageSender;

    constructor({
        sourceTag,
        modelPath,
        topic,
        topicType,
    }: {
        sourceTag: string;
        modelPath: string;
        topic: string;
        topicType: string;
    }) {
        this._tagName = sourceTag;
        this._modelPath = modelPath;
        this._topic = topic;
        this._topicType = topicType;
        this._tagName = sourceTag;
        this._nextTime = -1;
        this._policy = null;
        this._armed = false;
        this._stateToPublish = new State();
    }

    get policy(): MessagePublisherPolicy {
        return this._policy;
    }

    get modelPath(): string {
        return this._modelPath;
    }

    setPolicy(policy: MessagePublisherPolicy) {
        this._policy = policy.clone();
    }

    /*! Next publish event will occur in specified number of ms */
    update({ tagName, newState, currentTime }: { tagName: string; newState: State; currentTime: StateTS }): StateTS {
        this._lastStateVersion++; // keeps track of state changes
        if (tagName == this._tagName) {
            this._stateToPublish.timestamp = newState.timestamp;
            this._stateToPublish.value = castCorvinaType(newState.value, this._topicType);
        }
        if (this._policy) {
            this._nextTime = this._policy.updateState({
                tagName,
                newState,
                currentTime,
            });
        } else {
            this._nextTime = -1; // by default don't publish
        }
        return this._nextTime;
    }

    rearm(currentTime: StateTS): StateTS {
        if (this._policy) {
            this._nextTime = this._policy.rearm(currentTime);
        } else {
            this._nextTime = -1; // by default don't publish
        }
        this._armed = true;
        return this._nextTime;
    }

    nextTime(currentTime: StateTS): StateTS {
        if (!this._armed) {
            return this.rearm(currentTime);
        }
        return this._nextTime;
    }

    /* Derived class must reimplement this function to actually publish value */
    publish(currentTime: StateTS, messageSender: MessageSender, options?: InternalMessageSenderOptions) {
        // If there are no updates in the state from previous publish (we are polling a constant value from the cloud), use current timestamp
        // Otherwise try to use source timestamp
        const ts =
            this._lastPublishedStateVersion == this._lastStateVersion ? Date.now() : this._stateToPublish.timestamp;

        if (!ts) {
            // never received an update => don't send anything
            if (options?.cb) {
                options.cb(new Error("Nothing to send"), undefined);
            }
            return;
        }

        if (!this._topic) {
            if (options?.cb) {
                options.cb(new Error("No topic to send"), undefined);
            }
            this._lastPublishedStateVersion = this._lastStateVersion;
            this.rearm(currentTime);
            return;
        }
        messageSender.sendMessage(
            this._topic,
            {
                t: ts,
                v: this._stateToPublish.value,
            },
            options,
        );

        this._lastPublishedStateVersion = this._lastStateVersion;
        this.rearm(currentTime);
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

    toString(): string {
        return `MessagePublisher@${this._tagName} => ${this._topic} ( ${
            this._policy ? this._policy.toString() : "NULL"
        })`;
    }
}

/** Publish atomic structures */
export class AggregatedMessagePublisher extends MessagePublisher {
    private _recomputePolicy = false;

    constructor({ sourceTag, modelPath, topic }: { sourceTag: string; modelPath: string; topic: string }) {
        super({ sourceTag, modelPath, topic, topicType: "struct" });
        this._fields = [];
    }

    get modelPath(): string {
        return this._modelPath;
    }

    addField({ tagName, fieldName, type }: { tagName: string; fieldName: string; type: string }) {
        this._fields.push({
            tagName,
            fieldName,
            type,
            lastValueToPublish: undefined,
        });
        this._recomputePolicy = true;
    }

    update({ tagName, newState, currentTime }: { tagName: string; newState: State; currentTime: StateTS }): StateTS {
        if (this._policy && this._recomputePolicy) {
            this._fields.forEach((f) => {
                if (f.tagName == tagName) {
                    f.lastValueToPublish = castCorvinaType(newState.value, f.type);
                    // ensure current timestamp is always updated
                    this._stateToPublish.timestamp = newState.timestamp;
                }
                this._policy.setFieldTagName({
                    fieldName: f.fieldName,
                    tagName: f.tagName,
                });
            });
            this._policy = this._policy.multiTagVersion(this._fields.map((f) => f.tagName));
        }

        return super.update({ tagName, newState, currentTime });
    }

    publish(currentTime: StateTS, messageSender: MessageSender, options?: InternalMessageSenderOptions) {
        const ts =
            this._lastPublishedStateVersion == this._lastStateVersion ? Date.now() : this._stateToPublish.timestamp;

        const x = this._stateToPublish.value || {};
        this._fields.forEach((f) => {
            x[f.fieldName] = f.lastValueToPublish;
        });

        if (!this._topic) {
            if (options?.cb) {
                options.cb(new Error("No topic to send"), undefined);
            }
            this._lastPublishedStateVersion = this._lastStateVersion;
            this.rearm(currentTime);
            return;
        }
        messageSender.sendMessage(this._topic, { t: ts, v: x }, options);

        this._lastPublishedStateVersion = this._lastStateVersion;
        this.rearm(currentTime);
    }

    toString(): string {
        return `AggregatedMessagePublisher@${this._tagName} => ${this._topic} ( ${
            this._policy ? this._policy.toString() : "NULL"
        })`;
    }

    get fields() {
        return this._fields;
    }

    protected _fields: { tagName; fieldName; type; lastValueToPublish }[];
}
