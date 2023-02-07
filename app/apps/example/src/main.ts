import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import axios from "axios";
import { AppModule } from "./app.module";
import { Logger, LoggerService } from "@nestjs/common";
import { Logger as NestPinoLogger } from "nestjs-pino";
import { DeviceService, DeviceRunnerService } from "@corvina/device-client";

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: false,
    });
    const pinoLogger: LoggerService = app.get(NestPinoLogger);
    app.useLogger(pinoLogger);

    const l = new Logger("example");

    try {
        const config = new DocumentBuilder()
            .setTitle("Corvina NodeJS device API")
            .setDescription("")
            .setVersion("1.0")
            .addTag("device")
            .build();
        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup("swagger-ui", app, document);
    } catch (e) {
        l.error("Error caught: ");
        l.error(e);
    }

    await app.listen(process.env.PORT || 3000);

    app.get(DeviceRunnerService).run();

    const device = app.get(DeviceService);

    device.on("ready", (event) => {
        l.log("Device is ready to transmit data");
    });

    device.on("not_ready", (event) => {
        l.log("Device is not ready to transmit data");
    });

    device.on("write", (event) => {
        l.log("Write event received", event);
        if (process.env["WRITE_CALLBACK"]) {
            axios.post(process.env["WRITE_CALLBACK"], event).catch((err) => "Error executing write callback");
        }
    });
}
bootstrap();
