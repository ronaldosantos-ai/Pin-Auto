import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./migrate";

if (!process.env["GOOGLE_API_KEY"]) {
  throw new Error(
    "GOOGLE_API_KEY environment variable is required but was not provided. " +
      "Set it in your Railway project Variables.",
  );
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  await runMigrations();

  app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Startup failed");
  process.exit(1);
});
