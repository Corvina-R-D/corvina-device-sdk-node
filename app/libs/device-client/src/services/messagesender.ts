export interface MessageSender {
    sendMessage: (
        topic: string,
        payload: { t: number; v: unknown },
        options?: unknown,
    ) => Promise<any>;
}
