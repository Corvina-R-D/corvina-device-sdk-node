import { MessageSender } from "./messagesender";
import CorvinaDataInterface from "./corvinadatainterface";
import { State } from "./messagepublisherpolicies";

describe("Pusblisher", () => {
    beforeAll(async () => {
        // const moduleFixture = await Test.createTestingModule({
        //   imports: [AppModule],
        // }).compile();
        // await moduleFixture.createNestApplication().init();
    });

    class SimpleDeviceService extends CorvinaDataInterface {
        private sender: MessageSender;
        constructor(sender: MessageSender) {
            super();
            this.setCycleTime(1000);
            this.sender = sender;
        }
        public sendMessage(
            topic: string,
            payload: unknown,
            options?: unknown,
        ): Promise<any> {
            return this.sender.sendMessage(topic, payload as any, options);
        }
    }

    it("send messages", () => {
        jest.useFakeTimers();
        const sender: MessageSender = {
            sendMessage: jest.fn(
                async (
                    topic: string,
                    payload: unknown,
                    options?: any,
                ): Promise<any> => {
                    console.log(`sendMessage(${topic}, ${payload})`);
                    return true;
                },
            ),
        };
        const doPublishSpy = jest.spyOn(
            CorvinaDataInterface.prototype,
            "doPublish" as any,
        );

        let time = 0;
        (CorvinaDataInterface.prototype as any).monotonicTimer = jest.fn(() => {
            return time;
        });

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
                                        device_endpoint:
                                            "/com.exor.a1244/mount/0/a",
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
        expect(sender.sendMessage).not.toHaveBeenCalledWith(
            "/com.exor.a1244/mount/0/b",
            expect.anything(),
            undefined,
        );
        expect(sender.sendMessage).not.toHaveBeenCalledWith(
            "/com.exor.a1244/mount/0/a",
            expect.anything(),
            undefined,
        );

        // trigger provided => message is immediately sent
        c.notifyTag("/trigger", new State(1, 0));
        expect(sender.sendMessage).toHaveBeenCalledWith(
            "/com.exor.a1244/mount/0/",
            { t: expect.anything(), v: { a: 23 } },
            undefined,
        );

        (sender.sendMessage as ReturnType<typeof jest.fn>).mockClear();
        expect(sender.sendMessage).not.toHaveBeenCalledWith(
            expect.anything(),
            "/com.exor.a1244/mount/0/b",
            undefined,
        );

        time = 4500;
        jest.advanceTimersByTime(4500 - 1001);

        expect(sender.sendMessage).toHaveBeenCalledWith(
            "/com.exor.a1244/mount/0/b",
            expect.anything(),
            undefined,
        );

        c.stop();
    });
});
