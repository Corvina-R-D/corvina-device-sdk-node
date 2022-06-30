import { PacketPostCallback, PostCallback } from "./corvinadatainterface";

export interface MessageSenderOptions {
    qos?: number;
    recurseNotifyOnlyWholeObject?: boolean;
    forceImmediateSend?: boolean;
    cb?: PostCallback;
}

export interface InternalMessageSenderOptions {
    qos?: number;
    cb?: PacketPostCallback;
}

export interface MessageSender {
    sendMessage: (
        topic: string,
        payload: { t: number; v: unknown },
        options?: InternalMessageSenderOptions,
    ) => Promise<any>;
}
