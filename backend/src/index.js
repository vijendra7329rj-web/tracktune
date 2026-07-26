// Trigger deploy
import { execSync } from "child_process";
import app from "./app.js";
import { logger } from "./logger.js";
import fs from "fs";
import https from "https";

// Dynamic yt-dlp downloader helper for headless environments
async function ensureYtdlp() {
  if (process.platform !== "linux") return;
  
  const globalPath = "/usr/local/bin/yt-dlp";
  const tempPath = "/tmp/yt-dlp";
  
  if (fs.existsSync(globalPath) || fs.existsSync(tempPath)) {
    console.log("✅ yt-dlp executable already available.");
    return;
  }

  console.log("⬇️ yt-dlp not found on system. Downloading Linux binary dynamically to /tmp/yt-dlp...");
  try {
    const file = fs.createWriteStream(tempPath);
    
    const download = (url) => {
      return new Promise((resolve, reject) => {
        https.get(url, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            resolve(download(response.headers.location));
          } else if (response.statusCode === 200) {
            response.pipe(file);
            file.on("finish", () => {
              file.close();
              fs.chmodSync(tempPath, "755");
              console.log("✅ yt-dlp downloaded successfully to /tmp/yt-dlp");
              resolve();
            });
          } else {
            reject(new Error(`Failed to download: status ${response.statusCode}`));
          }
        }).on("error", reject);
      });
    };

    await download("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp");
  } catch (err) {
    console.error("❌ Failed to download yt-dlp dynamically:", err.message);
  }
}

// Start database migrations and then boot server
async function startServer() {
  // 1. Run database migrations programmatically on startup
  try {
    console.log("🔄 Programmatically running database migrations...");
    execSync("node src/migrate.js", { stdio: "inherit" });
  } catch (err) {
    console.error("❌ Migration failed on startup:", err.message);
  }

  // 2. Ensure yt-dlp is downloaded
  await ensureYtdlp();

  // 3. Listen
  const PORT = Number(process.env.PORT) || 10000;
  app.listen(PORT, () => {
    logger.info({ port: PORT }, "🎵 TrackTune API server listening");
    console.log(`TrackTune server is running on http://localhost:${PORT}`);
  });
}

startServer();
