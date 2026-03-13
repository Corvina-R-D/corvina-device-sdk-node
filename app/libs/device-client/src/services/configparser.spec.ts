import parseDeviceConfig, { DeviceConfiguration, DeviceConfigurationData, indexTemplateApply } from "./configparser";
import { AggregatedMessagePublisher, MessagePublisher } from "./messagepublisher";

const simpleConfig = {
    type: "datamodel",
    properties: {
        a1: {
            UUID: "2e6dui08pzrch2w1",
            instanceOf: "a1:1.0.0",
            type: "object",
            policies: {
                _0: {
                    triggers: [
                        {
                            changeMask: "value",
                            minIntervalMs: 1000,
                            skipFirstNChanges: 0,
                            type: "onchange",
                            sendPolicyMode: "",
                        },
                    ],
                    type: "send",
                },
            },
            interfaces: [
                {
                    aggregation: "individual",
                    interface_name: "com.exor.SfAIxYe7kU",
                    mappings: [
                        {
                            endpoint: "/%{uuid}/%{index}/PositionNow",
                            type: "integer",
                            explicit_timestamp: true,
                        },
                        {
                            endpoint: "/%{uuid}/%{index}/struct_a",
                            type: "integer",
                            explicit_timestamp: true,
                        },
                        {
                            endpoint: "/%{uuid}/%{index}/struct_b",
                            type: "integer",
                            explicit_timestamp: true,
                        },
                        {
                            endpoint: "/%{uuid}/%{index}/Tag1",
                            type: "integer",
                            explicit_timestamp: true,
                        },
                        {
                            endpoint: "/%{uuid}/%{index}/Tag2",
                            type: "integer",
                            explicit_timestamp: true,
                        },
                        {
                            endpoint: "/%{uuid}/%{index}/Tag3",
                            type: "integer",
                            explicit_timestamp: true,
                        },
                    ],
                    ownership: "device",
                    type: "datastream",
                    version_major: 1,
                    version_minor: 0,
                },
            ],
            properties: {
                PositionNow: {
                    type: "integer",
                    datalink: {
                        source: "PositionNow",
                    },
                    mode: "R",
                    historyPolicy: {
                        enabled: true,
                    },
                    sendPolicy: {
                        instanceOf: "_0",
                    },
                    mapping: {
                        device_endpoint: "/com.exor.SfAIxYe7kU/2e6dui08pzrch2w1/0/PositionNow",
                    },
                },
                struct_a: {
                    type: "integer",
                    datalink: {
                        source: "struct.a",
                    },
                    mode: "R",
                    historyPolicy: {
                        enabled: true,
                    },
                    sendPolicy: {
                        instanceOf: "_0",
                    },
                    mapping: {
                        device_endpoint: "/com.exor.SfAIxYe7kU/2e6dui08pzrch2w1/0/struct_a",
                    },
                },
                struct_b: {
                    type: "integer",
                    datalink: {
                        source: "struct.b",
                    },
                    mode: "R",
                    historyPolicy: {
                        enabled: true,
                    },
                    sendPolicy: {
                        instanceOf: "_0",
                    },
                    mapping: {
                        device_endpoint: "/com.exor.SfAIxYe7kU/2e6dui08pzrch2w1/0/struct_b",
                    },
                },
                Tag1: {
                    type: "integer",
                    datalink: {
                        source: "Tag1",
                    },
                    mode: "R",
                    historyPolicy: {
                        enabled: true,
                    },
                    sendPolicy: {
                        instanceOf: "_0",
                    },
                    mapping: {
                        device_endpoint: "/com.exor.SfAIxYe7kU/2e6dui08pzrch2w1/0/Tag1",
                    },
                },
                Tag2: {
                    type: "integer",
                    datalink: {
                        source: "Tag2",
                    },
                    mode: "R",
                    historyPolicy: {
                        enabled: true,
                    },
                    sendPolicy: {
                        instanceOf: "_0",
                    },
                    mapping: {
                        device_endpoint: "/com.exor.SfAIxYe7kU/2e6dui08pzrch2w1/0/Tag2",
                    },
                },
                Tag3: {
                    type: "integer",
                    datalink: {
                        source: "Tag3",
                    },
                    mode: "R",
                    historyPolicy: {
                        enabled: true,
                    },
                    sendPolicy: {
                        instanceOf: "_0",
                    },
                    mapping: {
                        device_endpoint: "/com.exor.SfAIxYe7kU/2e6dui08pzrch2w1/0/Tag3",
                    },
                },
            },
        },
    },
};

describe("Device config parser", () => {
    it("should apply array indexes", () => {
        expect(indexTemplateApply("/tag[${0},${1}]", [23, 17])).toBe("/tag[23,17]");
        expect(indexTemplateApply("/tag[$${0},${1}]", [23, 17])).toBe("/tag[$23,17]");
        expect(indexTemplateApply("/tag[$}${0},${1}]", [23, 17])).toBe("/tag[$}23,17]");
        expect(indexTemplateApply("/tag[{}${0},${1}]", [23, 17])).toBe("/tag[{}23,17]");
        expect(indexTemplateApply("/tag[\\${0},${1}]", [23, 17])).toBe("/tag[${0},17]");
        expect(indexTemplateApply("/tag[\\\\\\${0},${1}]", [23, 17])).toBe("/tag[\\${0},17]");
        expect(indexTemplateApply("/tag[\\\\${0},${1}]", [23, 17])).toBe("/tag[\\23,17]");
        expect(indexTemplateApply("/tag[${abc},${0}]", [23, 17])).toBe("/tag[,23]");
        expect(indexTemplateApply("/tag${0", [23, 17])).toBe("/tag");
        expect(indexTemplateApply("/tag${1}", [23, 17])).toBe("/tag17");
    });

    it("parse config", () => {
        const result: DeviceConfiguration = parseDeviceConfig(simpleConfig as any);
        expect(result.interfaceNames).toEqual(["com.exor.SfAIxYe7kU:1:0"]);
        expect([...result.namedPolicies.keys()]).toEqual(["_0"]);
        expect(result.tagPublishers.size).toEqual(6);
    });

    it("correctly parse simple array", () => {
        const datamodel: DeviceConfigurationData = {
            type: "datamodel",
            properties: {
                m: {
                    instanceOf: "m:1.0.0",
                    UUID: "",
                    type: "object",
                    interfaces: [],
                    properties: {
                        a: {
                            type: "array",
                            length: 10,
                            item: {
                                instanceOf: "a:1.0.0",
                                type: "object",
                                properties: {
                                    a: {
                                        type: "integer",
                                        datalink: { source: "/a/${0}" },
                                        mapping: {
                                            device_endpoint: "/com.exor.a1244/mount/${0}/a",
                                        },
                                        sendPolicy: {
                                            triggers: [
                                                {
                                                    type: "timer",
                                                    intervalMs: 1000,
                                                },
                                            ],
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };
        const result: DeviceConfiguration = parseDeviceConfig(datamodel as DeviceConfigurationData);
        expect(result.tagPublishers.size).toEqual(10);
        expect(result.tagPublishers.get("/a/5").size).toEqual(1);
        const pub: MessagePublisher = result.tagPublishers.get("/a/5").values().next().value;
        expect(pub.topic).toBe("/com.exor.a1244/mount/5/a");
        expect(pub.topicType).toBe("integer");
    });

    it("correctly parse structs", () => {
        const datamodel: DeviceConfigurationData = {
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
                                    // datalink: { source: "/b" },
                                    // mapping: { device_endpoint: "/com.exor.a1244/mount/0/a" },
                                    // sendPolicy: {
                                    //     triggers: [
                                    //         {
                                    //             type: "timer",
                                    //             intervalMs: 1000
                                    //         }
                                    //     ]
                                    // }
                                },
                            },
                            datalink: { source: "/wholeStruct" },
                            mapping: {
                                device_endpoint: "/com.exor.a1244/mount/${0}",
                            },
                            sendPolicy: {
                                triggers: [
                                    {
                                        type: "timer",
                                        intervalMs: 1000,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        };

        let result: DeviceConfiguration = parseDeviceConfig(datamodel as DeviceConfigurationData);
        expect(result.tagPublishers.size).toEqual(1);
        expect(result.tagPublishers.get("/wholeStruct").size).toBe(1);

        const datamodel1: DeviceConfigurationData = {
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
                            sendPolicy: {
                                triggers: [
                                    {
                                        type: "onchange",
                                        minIntervalMs: 1000,
                                        tagName: "/trigger",
                                        changeMask: "value",
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        };

        result = parseDeviceConfig(datamodel1 as DeviceConfigurationData);
        expect(result.tagPublishers.size).toEqual(2);
        expect(result.tagPublishers.get("/trigger").size).toBe(1);
        expect(result.tagPublishers.get("/b").size).toBe(1);

        // expect(result.tagPublishers.get("/wholeStruct")).toEqual(result.tagPublishers.get("/b"));
        expect((result.tagPublishers.get("/b").values().next().value as AggregatedMessagePublisher).fields.length).toBe(
            1,
        );
        const field = (result.tagPublishers.get("/b").values().next().value as AggregatedMessagePublisher).fields[0];
        expect(field.tagName).toBe("/b");
        expect(field.fieldName).toBe("a");
        expect(field.type).toBe("integer");
    });

    it("should not mix whole struct publisher with fields publisher", () => {
        const datamodel_ko: DeviceConfigurationData = {
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
                            datalink: { source: "/wholeStruct" },
                            mapping: {
                                device_endpoint: "/com.exor.a1244/mount/${0}",
                            },
                            sendPolicy: {
                                triggers: [
                                    {
                                        type: "timer",
                                        intervalMs: 1000,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        };

        const datamodel_ok: DeviceConfigurationData = {
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
                                    datalink: { source: "/wholeStruct" },
                                    mapping: {
                                        device_endpoint: "/com.exor.a1244/mount/${0}",
                                    },
                                },
                            },
                            datalink: { source: "/wholeStruct" },
                            mapping: {
                                device_endpoint: "/com.exor.a1244/mount/${0}",
                            },
                            sendPolicy: {
                                triggers: [
                                    {
                                        type: "timer",
                                        intervalMs: 1000,
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        };

        expect(() => {
            parseDeviceConfig(datamodel_ko as DeviceConfigurationData);
        }).toThrowError(/Cannot mix.*/);
        expect(() => {
            parseDeviceConfig(datamodel_ok as DeviceConfigurationData);
        }).not.toThrow();
    });
});
