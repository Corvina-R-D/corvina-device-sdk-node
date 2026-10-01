import { EventEmitter } from "events";
import { DeviceService } from "./device.service";

const DAY = 24 * 60 * 60 * 1000;

class MockMqttClient extends EventEmitter {
    connected = false;
    end = jest.fn(() => {
        this.connected = false;
        return this;
    });
    subscribe = jest.fn((topic: string, cb: (err?: Error) => void) => cb());
    publish = jest.fn((topic: string, message: unknown, options: unknown, cb?: (err?: Error) => void) => cb?.());
}

const mockClients: MockMqttClient[] = [];
jest.mock("mqtt", () => ({
    __esModule: true,
    default: {
        connect: jest.fn(() => {
            const client = new MockMqttClient();
            mockClients.push(client);
            return client;
        }),
    },
}));

jest.mock("pem", () => ({
    __esModule: true,
    default: {
        createCSR: (options: unknown, cb: (err: Error, obj: unknown) => void) => cb(null, { csr: "csr", clientKey: "key" }),
    },
}));

// Certificates used by the tests are JSON strings holding the fields read from the parsed certificate
jest.mock("x509.js", () => ({
    parseCert: (crt: string) => JSON.parse(crt),
}));

// Validity of the certificates returned by the next pairings
let mockCertLifetime = 10 * DAY;
const mockDoPairing = jest.fn(async () => {
    const now = Date.now();
    return {
        client_crt: JSON.stringify({
            subject: { commonName: "realm:device" },
            notBefore: new Date(now).toUTCString(),
            notAfter: new Date(now + mockCertLifetime).toUTCString(),
        }),
    };
});
jest.mock("./licensesaxiosinstance", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        init: jest.fn(async () => ({
            realm: "realm",
            logicalId: "device",
            apiKey: "apiKey",
            platformPairingApiUrl: "http://pairing",
            brokerUrls: ["mqtts://broker:8883"],
        })),
        doPairing: () => mockDoPairing(),
        verify: jest.fn(async () => true),
    })),
}));

describe("DeviceService certificate renewal", () => {
    let device: DeviceService;

    // Let the pending pairing promises run until the n-th mqtt client is created
    async function waitForClient(n: number): Promise<MockMqttClient> {
        for (let i = 0; i < 100 && mockClients.length < n; i++) {
            await jest.advanceTimersByTimeAsync(0);
        }
        expect(mockClients).toHaveLength(n);
        return mockClients[n - 1];
    }

    async function connect(client: MockMqttClient) {
        client.connected = true;
        client.emit("connect", {});
        await jest.advanceTimersByTimeAsync(0);
        expect(device.isReady()).toBe(true);
    }

    beforeEach(async () => {
        jest.useFakeTimers();
        mockClients.length = 0;
        mockCertLifetime = 10 * DAY;
        mockDoPairing.mockClear();
        device = new DeviceService();
        device.reinit({ pairingEndpoint: "http://licenses", activationKey: "key" });
        await connect(await waitForClient(1));
        expect(mockDoPairing).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
        device.onModuleDestroy();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("pairs again when 80% of the certificate lifetime has elapsed", async () => {
        await jest.advanceTimersByTimeAsync(8 * DAY - 1000);
        expect(mockDoPairing).toHaveBeenCalledTimes(1);
        expect(mockClients[0].end).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1000);
        const renewed = await waitForClient(2);
        expect(mockClients[0].end).toHaveBeenCalled();
        expect(mockDoPairing).toHaveBeenCalledTimes(2);

        await connect(renewed);
    });

    it("schedules renewal of certificates lasting longer than the maximum timer delay", async () => {
        mockCertLifetime = 365 * DAY;
        device.reinit({ pairingEndpoint: "http://licenses", activationKey: "key" });
        await connect(await waitForClient(2));
        expect(mockDoPairing).toHaveBeenCalledTimes(2);

        await jest.advanceTimersByTimeAsync(292 * DAY - 1000);
        expect(mockDoPairing).toHaveBeenCalledTimes(2);

        await jest.advanceTimersByTimeAsync(1000);
        await waitForClient(3);
        expect(mockDoPairing).toHaveBeenCalledTimes(3);
    });

    it("pairs again when the broker rejects the expired certificate", async () => {
        const client = mockClients[0];
        client.emit("close");
        expect(device.isReady()).toBe(false);
        client.emit(
            "error",
            Object.assign(new Error("ssl/tls alert certificate expired"), {
                code: "ERR_SSL_SSL/TLS_ALERT_CERTIFICATE_EXPIRED",
            }),
        );

        expect(client.end).toHaveBeenCalledWith(true);
        await connect(await waitForClient(2));
        expect(mockDoPairing).toHaveBeenCalledTimes(2);
    });

    it("keeps the current certificate on other connection errors", async () => {
        const client = mockClients[0];
        client.emit("error", Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }));

        await jest.advanceTimersByTimeAsync(60 * 1000);
        expect(client.end).not.toHaveBeenCalled();
        expect(mockClients).toHaveLength(1);
        expect(mockDoPairing).toHaveBeenCalledTimes(1);
    });

    it("ignores certificate errors coming from a replaced client", async () => {
        await jest.advanceTimersByTimeAsync(8 * DAY);
        const renewed = await waitForClient(2);
        await connect(renewed);

        mockClients[0].emit(
            "error",
            Object.assign(new Error("ssl/tls alert certificate expired"), {
                code: "ERR_SSL_SSL/TLS_ALERT_CERTIFICATE_EXPIRED",
            }),
        );
        await jest.advanceTimersByTimeAsync(0);
        expect(renewed.end).not.toHaveBeenCalled();
        expect(mockDoPairing).toHaveBeenCalledTimes(2);
    });

    it("cancels the scheduled renewal when the module is destroyed", async () => {
        device.onModuleDestroy();
        await jest.advanceTimersByTimeAsync(10 * DAY);
        expect(mockDoPairing).toHaveBeenCalledTimes(1);
        expect(mockClients).toHaveLength(1);
    });
});
