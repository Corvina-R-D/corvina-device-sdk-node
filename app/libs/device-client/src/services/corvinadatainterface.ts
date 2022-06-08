import { MessageSubscriber } from "./messagesubscriber";
import { Injectable, Logger as l } from "@nestjs/common";
import { EventEmitter } from "stream";
import parseDeviceConfig, { DeviceConfiguration, DeviceConfigurationData } from "./configparser";
import { INVALID_STATE_TS, State } from "./messagepublisherpolicies";
import { MessageSender } from "./messagesender";
import { castCorvinaType } from "../common/types";

/**
 * The CorvinaClient manages the configuration of the device sent by
 * the cloud.
 */
@Injectable()
export default class CorvinaDataInterface extends EventEmitter implements MessageSender {
    protected _config: DeviceConfiguration;
    private CYCLE_TIME: number;

    protected _nextTick: number;
    protected _internalTimer: NodeJS.Timer;

    constructor() {
        super();
        this.CYCLE_TIME = 1000;
    }

    public setCycleTime(cycleTime: number) {
        this.CYCLE_TIME = cycleTime;
    }

    public sendMessage(topic: string, payload: unknown, options?: unknown): Promise<any> {
        // implement me
        return new Promise(undefined);
    }

    protected monotonicTimer(): number {
        return Number(process.hrtime.bigint() / 1000000n);
    }

    public start() {
        this.doPublish();
        this._internalTimer = setInterval(() => {
            this.doPublish();
        }, this.CYCLE_TIME);
    }

    public stop() {
        clearInterval(this._internalTimer);
        this._internalTimer = null;
    }

    /**
     * Publish periodic publishers
     */
    protected doPublish() {
        if (!this._config) {
            return;
        }
        this._nextTick = INVALID_STATE_TS;

        // anything in the range of now and half time to next tick will be sent
        const now = this.monotonicTimer() + this.CYCLE_TIME / 2;
        for (const p of this._config.tagPublishers.values()) {
            for (const mp of p.values()) {
                if (mp.nextTime(now) <= now) {
                    mp.publish(now, this);
                }
            }
        }
    }

    public applyConfig(config: DeviceConfigurationData) {
        this._config = parseDeviceConfig(config);
    }

    /**
     * Notify a tag change and check if some publisher is required to publish it
     * @param tagName : the source tag to publish
     * @param newState : the new tag state to publish
     */
    public notifyTag(tagName: string, newState: State) {
        let nextTime = INVALID_STATE_TS;
        const currentTime = this.monotonicTimer();
        const tagPublishers = this._config.tagPublishers.get(tagName);

        if (!tagPublishers || tagPublishers.size == 0) {
            l.verbose("Cannot publish unconfigured tag " + tagName);
            return;
        }

        tagPublishers.forEach((publisher) => {
            nextTime = Math.min(nextTime, publisher.update({ tagName, newState, currentTime }));
            
            if (nextTime <= currentTime) {
                publisher.publish(currentTime, this);
            }
        });
    }

    public onWrite(subscriber: MessageSubscriber, message: any) {
        l.verbose("CorvinaDataInterface.onWrite", message);
        this.emit("write", {
            topic: subscriber.topic,
            modelPath: subscriber.modelPath,
            fieldName: subscriber.fieldName,
            v: castCorvinaType(message.v, subscriber.topicType),
        });
    }
}
