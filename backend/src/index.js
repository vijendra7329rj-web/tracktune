import { execSync } from "child_process";
import app from "./app.js";
import { logger } from "./logger.js";
import fs from "fs";
import https from "https";
import axios from "axios";

// Dynamic yt-dlp downloader helper for headless environments (Render/Linux)
async function ensureYtdlp() {
  if (process.platform !== "linux") return;
  
  const tempPath = "/tmp/yt-dlp";
  const nightlyUrl = "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp";

  // 1. If binary already exists, try updating to latest nightly build
  if (fs.existsSync(tempPath)) {
    try {
      console.log("🔄 Updating existing /tmp/yt-dlp to latest nightly...");
      execSync(`${tempPath} --update-to nightly`, { stdio: "inherit", timeout: 30000 });
      console.log("✅ yt-dlp updated to latest nightly.");
      return;
    } catch (updateErr) {
      console.warn("⚠️ Self-update failed, re-downloading fresh nightly binary:", updateErr.message);
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }
  }

  // 2. Download fresh nightly binary (contains latest YouTube player response fixes)
  console.log(`⬇️ Downloading latest yt-dlp nightly build from ${nightlyUrl}...`);
  try {
    try {
      execSync(`curl -sL "${nightlyUrl}" -o ${tempPath} && chmod 755 ${tempPath}`, { stdio: "inherit", timeout: 45000 });
      console.log("✅ yt-dlp nightly downloaded successfully via curl.");
      return;
    } catch (curlErr) {
      console.log("curl not available or failed, falling back to axios stream...", curlErr.message);
    }

    const response = await axios({
      method: "get",
      url: nightlyUrl,
      responseType: "stream",
      maxRedirects: 10,
      timeout: 60000
    });

    const file = fs.createWriteStream(tempPath);
    response.data.pipe(file);

    await new Promise((resolve, reject) => {
      file.on("finish", () => {
        file.close();
        fs.chmodSync(tempPath, "755");
        console.log("✅ yt-dlp nightly downloaded and verified in /tmp/yt-dlp");
        resolve();
      });
      file.on("error", reject);
    });
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
