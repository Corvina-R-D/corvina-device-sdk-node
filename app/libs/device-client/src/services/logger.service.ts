import dotenv from "dotenv";
dotenv.config();

import pino from "pino";

export const l = pino({
    name: process.env.LOG_CONTEXT || process.env.APP_ID,
    level: process.env.LOG_LEVEL || "info",
});
