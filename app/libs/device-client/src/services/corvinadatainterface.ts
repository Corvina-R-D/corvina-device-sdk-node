import { MessageSubscriber } from "./messagesubscriber";
import { EventEmitter } from "stream";
import parseDeviceConfig, { DeviceConfiguration, DeviceConfigurationData } from "./configparser";
import { INVALID_STATE_TS, State } from "./messagepublisherpolicies";
import { InternalMessageSenderOptions, MessageSender, MessageSenderOptions } from "./messagesender";
import { castCorvinaType } from "../common/types";
import { l } from "./logger.service";
/**
 * Report notification errors for this post operation or the updated modelPaths
 */
export declare type PostCallback = (error: Error, tagName: string, modelPath: string) => any;
export declare type PacketPostCallback = (error?: Error, packet?: any) => any;

/**
 * The CorvinaClient manages the configuration of the device sent by
 * the cloud.
 */
export default class CorvinaDataInterface extends EventEmitter {
    protected _config: DeviceConfiguration;
    private CYCLE_TIME: number;

    protected _nextTick: number;
    protected _internalTimer: NodeJS.Timer;
    protected _sender;

    get config(): DeviceConfiguration {
        return this._config;
    }

    constructor(sender: MessageSender) {
        super();
        this._sender = sender;
        this.CYCLE_TIME = 1000;
    }

    public setCycleTime(cycleTime: number) {
        this.CYCLE_TIME = cycleTime;
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
                    mp.publish(now, this._sender);
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
    public notifyTag(tagName: string, newState: State, options?: MessageSenderOptions) {
        let nextTime = INVALID_STATE_TS;
        const currentTime = this.monotonicTimer();
        const tagPublishers = this._config.tagPublishers.get(tagName);

        if (!tagPublishers || tagPublishers.size == 0) {
            const err = "Cannot publish unconfigured tag " + tagName;
            if (options?.cb) {
                options.cb(new Error(err), tagName, undefined);
            }
            l.debug("Cannot publish unconfigured tag " + tagName);
            return;
        }

        let nothingToPublish = true;
        tagPublishers.forEach((publisher) => {
            nextTime = Math.min(nextTime, publisher.update({ tagName, newState, currentTime }));

            if (nextTime <= currentTime || options?.forceImmediateSend) {
                nothingToPublish = false;
                const internalOptions = { ...options };
                if (options?.cb) {
                    internalOptions.cb = (err, pkt) => {
                        if (err) {
                            options.cb(err, tagName, publisher.modelPath);
                        } else {
                            options.cb(undefined, tagName, publisher.modelPath);
                        }
                    };
                } else {
                    const internalOptions = { ...options };
                    internalOptions.cb = (err, pkt) => {
                        if (err) {
                            // log errors occurred during publish
                            l.error(err);
                        }
                    };
                }
                publisher.publish(currentTime, this._sender, internalOptions as InternalMessageSenderOptions);
            }
        });
        if (nothingToPublish) {
            if (options?.cb) {
                options.cb(undefined, undefined, undefined);
            }
        }
    }

}
