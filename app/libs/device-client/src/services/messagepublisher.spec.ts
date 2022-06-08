import { MessageSender } from "./messagesender";
import CorvinaDataInterface from "./corvinadatainterface";
import { State } from "./messagepublisherpolicies";

describe("Publisher", () => {
    const sender: MessageSender = {
        sendMessage: jest.fn(async (topic: string, payload: unknown, options?: any): Promise<any> => {
            console.log(`sendMessage(${topic}, ${payload})`);
            return true;
        }),
    };

    const doPublishSpy = jest.spyOn(CorvinaDataInterface.prototype, "doPublish" as any);

    let time = 0;
    (CorvinaDataInterface.prototype as any).monotonicTimer = jest.fn(() => {
        return time;
    });

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        time = 0;
    });

    class SimpleDeviceService extends CorvinaDataInterface {
        private sender: MessageSender;
        constructor(sender: MessageSender) {
            super();
            this.setCycleTime(1000);
            this.sender = sender;
        }
        public sendMessage(topic: string, payload: unknown, options?: unknown): Promise<any> {
            return this.sender.sendMessage(topic, payload as any, options);
        }
    }

    it("send messages of simple type with trigger", () => {
        const c = new SimpleDeviceService(sender);
        c.applyConfig({
            type: "datamodel",
            properties: {
                m: {
                    instanceOf: "m:1.0.0",
                    UUID: "",
                    type: "object",
                    interfaces: [],
                    properties: {
                        b: {
                            type: "integer",
                            datalink: { source: "/c" },
                            mapping: {
                                device_endpoint: "/com.exor.a1244/mount/0/b",
                            },
                            sendPolicy: {
                                triggers: [
                                    {
                                        type: "onchange",
                                        minIntervalMs: 1000,
                                        skipFirstNChanges: 0,
                                        changeMask: "value",
                                        tagName: "/trigger",
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        });

        c.start(); // will call publish and advance timer by 1000
        // expect(doPublishSpy).toHaveBeenCalledTimes(1);

        expect(sender.sendMessage).toHaveBeenCalledTimes(0);

        time = 1001;
        jest.advanceTimersByTime(1001);

        // trigger provided => message is immediately sent
        // c.notifyTag("/c", new State(23, 0));
        c.notifyTag("/trigger", new State(1, 0));

        // avoid to send null values
        expect(sender.sendMessage).toHaveBeenCalledTimes(0);

        c.notifyTag("/c", new State(23, 1001));
        // the message is sent because the trigger is active
        expect(sender.sendMessage).toHaveBeenCalledTimes(1);

        time = 2001;
        jest.advanceTimersByTime(2001);

        c.notifyTag("/c", new State(24, 2000));
        expect(sender.sendMessage).toHaveBeenCalledTimes(1);

        c.notifyTag("/trigger", new State(2, 2000));
        // must wait the timeout
        expect(sender.sendMessage).toHaveBeenCalledTimes(2);

        expect(sender.sendMessage).toHaveBeenCalledWith("/com.exor.a1244/mount/0/b", { t: 1001, v: 23 }, undefined);
        expect(sender.sendMessage).toHaveBeenCalledWith("/com.exor.a1244/mount/0/b", { t: 2000, v: 24 }, undefined);
    });

    it("send messages of structure type with trigger", () => {
        const c = new SimpleDeviceService(sender);
        c.applyConfig({
            type: "datamodel",
            properties: {
                m: {
                    instanceOf: "m:1.0.0",
                    UUID: "",
                    type: "object",
                    interfaces: [],
                    properties: {
                        a: {
                            type: "struct",
                            instanceOf: "a:1.0.0",
                            properties: {
                                a: {
                                    type: "integer",
                                    datalink: { source: "/b" },
                                    mapping: {
                                        device_endpoint: "/com.exor.a1244/mount/0/a",
                                    },
                                },
                            },
                            // datalink: { source: "/wholeStruct" },
                            mapping: {
                                device_endpoint: "/com.exor.a1244/mount/0/",
                            },
                            sendPolicy: {
                                triggers: [
                                    {
                                        type: "onchange",
                                        minIntervalMs: 1000,
                                        skipFirstNChanges: 0,
                                        changeMask: "value",
                                        tagName: "/trigger",
                                    },
                                ],
                            },
                        },
                        b: {
                            type: "integer",
                            datalink: { source: "/c" },
                            mapping: {
                                device_endpoint: "/com.exor.a1244/mount/0/b",
                            },
                            sendPolicy: {
                                triggers: [
                                    {
                                        type: "timer",
                                        intervalMs: 5000,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        });

        c.notifyTag("/b", new State(23, 0));
        c.start();
        expect(doPublishSpy).toHaveBeenCalledTimes(1);

        expect(sender.sendMessage).toHaveBeenCalledTimes(0);
        time = 999;
        expect(sender.sendMessage).toHaveBeenCalledTimes(0);
        time = 1001;
        jest.advanceTimersByTime(1001);
        expect(doPublishSpy).toHaveBeenCalledTimes(2);
        // trigger missing
        expect(sender.sendMessage).not.toHaveBeenCalledWith("/com.exor.a1244/mount/0/b", expect.anything(), undefined);
        expect(sender.sendMessage).not.toHaveBeenCalledWith("/com.exor.a1244/mount/0/a", expect.anything(), undefined);

        // trigger provided => message is immediately sent
        c.notifyTag("/trigger", new State(1, 0));
        expect(sender.sendMessage).toHaveBeenCalledWith(
            "/com.exor.a1244/mount/0/",
            { t: expect.anything(), v: { a: 23 } },
            undefined,
        );

        (sender.sendMessage as ReturnType<typeof jest.fn>).mockClear();
        expect(sender.sendMessage).not.toHaveBeenCalledWith(expect.anything(), "/com.exor.a1244/mount/0/b", undefined);

        time = 4500;
        jest.advanceTimersByTime(4500 - 1001);

        expect(sender.sendMessage).toHaveBeenCalledWith("/com.exor.a1244/mount/0/b", expect.anything(), undefined);

        doPublishSpy.mockClear();

        c.stop();
    });

    it("send messages of structure type with whole struct", () => {
        const c = new SimpleDeviceService(sender);
        c.applyConfig({
            type: "datamodel",
            properties: {
                m: {
                    instanceOf: "m:1.0.0",
                    UUID: "",
                    type: "object",
                    interfaces: [],
                    properties: {
                        a: {
                            type: "struct",
                            instanceOf: "a:1.0.0",
                            properties: {
                                a: {
                                    type: "integer",
                                    mapping: {
                                        device_endpoint: "/com.exor.a1244/mount/0/a",
                                    },
                                },
                            },
                            datalink: { source: "/wholeStruct" },
                            mapping: {
                                device_endpoint: "/com.exor.a1244/mount/0/",
                            },
                            sendPolicy: {
                                triggers: [
                                    {
                                        type: "onchange",
                                        minIntervalMs: 1000,
                                        skipFirstNChanges: 0,
                                        changeMask: "value",
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        });

        c.notifyTag("/wholeStruct", new State({ a: 1, b: 2 }, 0));
        c.start();
        expect(doPublishSpy).toHaveBeenCalledTimes(1);

        expect(sender.sendMessage).not.toHaveBeenCalledWith(
            "/com.exor.a1244/mount/0",
            { t: 0, v: { a: 1, b: 2 } },
            undefined,
        );

        c.notifyTag("/wholeStruct", new State({ a: 1, b: 2 }, 0));

        time = 1001;
        jest.advanceTimersByTime(1001);

        // should not be sent if value did not change
        expect(sender.sendMessage).toHaveBeenCalledTimes(1);

        c.notifyTag("/wholeStruct", new State({ a: 1, b: 3 }, 1001));

        time = 2001;
        jest.advanceTimersByTime(2001);

        expect(sender.sendMessage).toHaveBeenCalledTimes(2);

        // should send have sent the changed value
        expect(sender.sendMessage).not.toHaveBeenCalledWith(
            "/com.exor.a1244/mount/0",
            { t: 1001, v: { a: 1, b: 3 } },
            undefined,
        );
    });
});
