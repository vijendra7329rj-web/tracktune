import { execSync } from "child_process";
import app from "./app.js";
import { logger } from "./logger.js";

// Run database migrations programmatically on startup
try {
  console.log("🔄 Programmatically running database migrations...");
  execSync("node src/migrate.js", { stdio: "inherit" });
} catch (err) {
  console.error("❌ Migration failed on startup:", err.message);
}

const PORT = Number(process.env.PORT) || 10000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, "🎵 TrackTune API server listening");
  console.log(`TrackTune server is running on http://localhost:${PORT}`);
});
