import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    const config = new DocumentBuilder()
        .setTitle("Corvina NodeJS device API")
        .setDescription("")
        .setVersion("1.0")
        .addTag("device")
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("swagger-ui", app, document);

    await app.listen(3000);
}
bootstrap();
