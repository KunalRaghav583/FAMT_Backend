import app from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";

export const APP_NAME = "Field Asset Maintenance Tracker";
export const API_VERSION = "1.0.0";

const server =
  process.env.NODE_ENV === "test"
    ? null
    : app.listen(env.PORT, () => {
        console.log(
          `[${APP_NAME}] Server running in ${env.NODE_ENV} mode on port ${env.PORT}`,
        );
      });

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  if (!server) {
    await prisma.$disconnect();
    process.exit(0);
  }
  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await prisma.$disconnect();
      console.log("Database connection closed.");
      process.exit(0);
    } catch (err) {
      console.error("Error during database disconnection:", err);
      process.exit(1);
    }
  });

  // Force close if graceful shutdown takes too long
  setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

export default server;
