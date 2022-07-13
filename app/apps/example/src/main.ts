import { DeviceService, DeviceRunnerService } from "@corvina/corvina-device-sdk";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

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
        console.error("Error caught: ", e);
    }

    await app.listen(3000);

    app.get(DeviceRunnerService).run();
    app.get(DeviceService).on("write", (event) => {
        console.log("Write event received", event);
    });
}
bootstrap();
