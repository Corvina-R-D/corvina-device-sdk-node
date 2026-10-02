// Keep pino quiet during tests unless LOG_LEVEL is set explicitly: its direct stdout writes
// trigger Jest's buffered-output flush timer, which --detectOpenHandles reports as an open handle.
process.env.LOG_LEVEL ??= "silent";
