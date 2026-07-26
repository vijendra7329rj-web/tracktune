import { Router } from "express";
import { db } from "../db.js";
import { moviesTable, movieHistoryTable } from "../schema.js";
import { eq, and } from "drizzle-orm";
import youtubedl from "yt-dlp-exec";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import { execFile } from "child_process";
import { promisify } from "util";

const router = Router();
const execFileAsync = promisify(execFile);

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe";

// ── Helpers ──

function extractUrl(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

async function runTool(command, args, timeout = 30000) {
  const result = await execFileAsync(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 10,
    encoding: "utf8",
  });
  return {
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

async function getDurationSeconds(filePath) {
  try {
    const { stdout } = await runTool(
      FFPROBE_PATH,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      20000,
    );
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : 15;
  } catch (error) {
    console.warn("ffprobe duration failed, falling back to 15 seconds", error);
    return 15;
  }
}

// Extract 3 screenshot frames at 20%, 50%, and 80% of video duration
async function extractFrames(sourcePath, tempDir, debugId) {
  const duration = await getDurationSeconds(sourcePath);
  const timestamps = [duration * 0.2, duration * 0.5, duration * 0.8];
  const imagePaths = [];

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const outputPath = path.join(tempDir, `tracktune_${debugId}_frame_${i}.jpg`);
    try {
      console.log(`[${debugId}] Extracting frame ${i} at ${timestamp.toFixed(2)}s`);
      await runTool(
        FFMPEG_PATH,
        ["-hide_banner", "-y", "-ss", timestamp.toFixed(2), "-i", sourcePath, "-vframes", "1", "-q:v", "2", outputPath],
        30000
      );
      if (fs.existsSync(outputPath)) {
        imagePaths.push(outputPath);
      }
    } catch (err) {
      console.warn(`[${debugId}] Failed to extract frame ${i}:`, err.message);
    }
  }

  return imagePaths;
}

// ── Download Video Helper ──

const COBALT_MIRRORS = [
  "https://co.wuk.sh/api/json",
  "https://api.cobalt.tools",
  "https://cobalt.shizuku.io/api/json",
  "https://cobalt.xyz/api/json"
];

async function downloadViaMirror(url, targetPath, debugId) {
  let lastError = null;
  for (const mirror of COBALT_MIRRORS) {
    try {
      console.log(`[${debugId}] Attempting mirror download from: ${mirror}`);
      const response = await axios.post(mirror, {
        url: url,
        codec: "mp3",
        downloadMode: "auto" // Download full video so we can extract frames
      }, {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 15000
      });

      const downloadUrl = response.data?.url;
      if (!downloadUrl) {
        throw new Error(`Mirror ${mirror} did not return direct download link.`);
      }

      console.log(`[${debugId}] Mirror succeeded. Downloading video payload...`);
      const fileResponse = await axios({
        method: "get",
        url: downloadUrl,
        responseType: "stream",
        timeout: 25000
      });

      const writer = fs.createWriteStream(targetPath);
      fileResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`[${debugId}] Video saved. Size: ${fs.statSync(targetPath).size} bytes`);
      return true;
    } catch (err) {
      console.warn(`[${debugId}] Mirror ${mirror} failed:`, err.message);
      lastError = err;
    }
  }
  throw new Error(`All download mirrors failed. Last error: ${lastError?.message}`);
}

async function downloadVideo(url, sourceTemplate, debugId) {
  const tempDir = "/tmp";
  const mirrorPath = path.join(tempDir, `tracktune_${debugId}_source.mp4`);

  // Try public mirrors first (to avoid local IP blocks)
  try {
    await downloadViaMirror(url, mirrorPath, debugId);
    return mirrorPath;
  } catch (mirrorError) {
    console.warn(`[${debugId}] Public mirror chain failed, falling back to local yt-dlp...`, mirrorError.message);
  }

  // Local yt-dlp fallback
  const ytdlpOptions = {
    output: sourceTemplate,
    noWarnings: true,
    noCallHome: true,
    addHeader: [
      "User-Agent:Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
      "Accept-Language:en-US,en;q=0.9"
    ]
  };

  const cookiesEnv = process.env.YOUTUBE_COOKIES;
  let cookieFilePath = null;
  if (cookiesEnv) {
    cookieFilePath = path.join(tempDir, `yt_cookies_${debugId}.txt`);
    try {
      fs.writeFileSync(cookieFilePath, cookiesEnv, "utf8");
      ytdlpOptions.cookies = cookieFilePath;
    } catch (e) {
      console.warn("Failed to write cookies file:", e.message);
    }
  }

  try {
    console.log(`[${debugId}] Downloading video locally for: ${url}`);
    await youtubedl(url, ytdlpOptions);
    const files = fs.readdirSync(tempDir);
    const downloadedFile = files.find((f) => f.startsWith(`tracktune_${debugId}_source.`));
    if (!downloadedFile) {
      throw new Error("Download failed - local file not created");
    }
    const sourcePath = path.join(tempDir, downloadedFile);
    console.log(`[${debugId}] Local yt-dlp success. Size: ${fs.statSync(sourcePath).size} bytes`);
    return sourcePath;
  } finally {
    if (cookieFilePath && fs.existsSync(cookieFilePath)) {
      try { fs.unlinkSync(cookieFilePath); } catch (e) {}
    }
  }
}

// ── Movie Identification & Streaming Lookups ──

async function identifyMovieWithGemini(imagePaths, debugId) {
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  if (!apiKey) {
    throw new Error("TrackTune is missing the GEMINI_API_KEY environment variable.");
  }

  console.log(`[${debugId}] Calling Gemini 1.5 Flash API...`);
  const imageParts = [];

  for (const imgPath of imagePaths) {
    if (fs.existsSync(imgPath)) {
      const base64 = fs.readFileSync(imgPath).toString("base64");
      imageParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64
        }
      });
    }
  }

  if (imageParts.length === 0) {
    throw new Error("Could not extract any image frames from the video for AI analysis.");
  }

  const prompt = "Identify the movie or TV show title and release year from the attached visual frames. The clip might be highly edited (may have color filters or quick cuts). Use actors' faces, settings, visual styles, and any clues in the scenes. Respond ONLY with a JSON object in this exact format: {\"title\": \"Movie Title\", \"year\": 2024, \"confidence\": 95, \"genres\": [\"Action\"]}. If you cannot identify it, set title to empty string and year and confidence to 0.";

  const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    contents: [
      {
        parts: [
          { text: prompt },
          ...imageParts
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  }, {
    timeout: 30000
  });

  const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error("Gemini API returned an empty response.");
  }

  const result = JSON.parse(responseText.trim());
  console.log(`[${debugId}] Gemini response:`, result);
  return result;
}

async function getWatchmodeStreamingData(title, year, debugId) {
  const apiKey = process.env.WATCHMODE_API_KEY ? process.env.WATCHMODE_API_KEY.trim() : null;
  if (!apiKey) {
    console.warn(`[${debugId}] WATCHMODE_API_KEY is not set. Skipping streaming links.`);
    return { watchmodeId: "", watchLinks: "[]", poster: "", plot: "" };
  }

  try {
    console.log(`[${debugId}] Searching Watchmode for: "${title} (${year})"`);
    const searchRes = await axios.get(`https://api.watchmode.com/v1/search/`, {
      params: {
        apiKey,
        search_value: title,
        search_type: 1
      },
      timeout: 15000
    });

    const results = searchRes.data?.results || [];
    // Find matching title + release year
    const match = results.find(r => r.name.toLowerCase() === title.toLowerCase() && Math.abs(Number(r.year || 0) - year) <= 1) || results[0];
    
    if (!match) {
      console.warn(`[${debugId}] No matching title found in Watchmode.`);
      return { watchmodeId: "", watchLinks: "[]", poster: "", plot: "" };
    }

    const watchmodeId = match.id;
    console.log(`[${debugId}] Found Watchmode ID: ${watchmodeId}. Fetching details & sources...`);

    // Fetch details (overview, poster, actors)
    const detailsRes = await axios.get(`https://api.watchmode.com/v1/title/${watchmodeId}/details/`, {
      params: { apiKey },
      timeout: 15000
    });

    // Fetch streaming links for India region (IN)
    const sourcesRes = await axios.get(`https://api.watchmode.com/v1/title/${watchmodeId}/sources/`, {
      params: {
        apiKey,
        regions: "IN"
      },
      timeout: 15000
    });

    const sources = sourcesRes.data || [];
    // Filter and map only relevant streaming services (Netflix, Prime, Hotstar, etc.)
    const watchLinks = sources.map(s => ({
      name: s.name,
      type: s.type, // e.g. sub, rent, buy
      url: s.web_url,
      format: s.format
    }));

    return {
      watchmodeId: String(watchmodeId),
      watchLinks: JSON.stringify(watchLinks),
      poster: detailsRes.data?.poster || "",
      plot: detailsRes.data?.plot_overview || ""
    };
  } catch (err) {
    console.error(`[${debugId}] Watchmode API call failed:`, err.message);
    return { watchmodeId: "", watchLinks: "[]", poster: "", plot: "" };
  }
}

// ── Route Handler ──

router.post("/identify-movie", async (req, res) => {
  const debugId = crypto.randomUUID();
  const rawUrl = req.body.url || "";
  const url = extractUrl(rawUrl);

  if (!url) {
    return res.status(400).json({ error: "Please share or paste a valid video URL.", debugId });
  }

  const tempDir = "/tmp";
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const sourceTemplate = path.join(tempDir, `tracktune_${debugId}_source.%(ext)s`);
  const tempFiles = [];

  try {
    // 1. Download video
    const sourcePath = await downloadVideo(url, sourceTemplate, debugId);
    tempFiles.push(sourcePath);

    // 2. Extract 3 frames
    const imagePaths = await extractFrames(sourcePath, tempDir, debugId);
    tempFiles.push(...imagePaths);

    // 3. Ask Gemini to identify movie
    const geminiResult = await identifyMovieWithGemini(imagePaths, debugId);

    if (!geminiResult.title || geminiResult.confidence < 50) {
      return res.status(404).json({
        error: "TrackTune AI could not identify this movie. Make sure the video contains movie footage.",
        debugId
      });
    }

    // ── DATABASE CACHE CHECK ──
    // Check if we have already saved this movie details before
    let movie = null;
    const existingMovies = await db.select().from(moviesTable)
      .where(and(eq(moviesTable.title, geminiResult.title), eq(moviesTable.year, geminiResult.year)))
      .limit(1);

    if (existingMovies.length > 0) {
      console.log(`[${debugId}] Database Cache Hit for: "${geminiResult.title}"`);
      movie = existingMovies[0];
    } else {
      // 4. Fetch details & streaming links from Watchmode
      const movieDetails = await getWatchmodeStreamingData(geminiResult.title, geminiResult.year, debugId);

      // Save to database
      const [newMovie] = await db.insert(moviesTable).values({
        title: geminiResult.title,
        year: geminiResult.year,
        overview: movieDetails.plot || "No overview available.",
        posterUrl: movieDetails.poster || "",
        genre: geminiResult.genres ? geminiResult.genres.join(", ") : "Drama",
        watchmodeId: movieDetails.watchmodeId,
        watchLinks: movieDetails.watchLinks,
      }).returning();
      
      movie = newMovie;
    }

    // Save to user search history
    await db.insert(movieHistoryTable).values({
      movieId: movie.id,
      title: movie.title,
      year: movie.year,
      posterUrl: movie.posterUrl,
    });

    return res.json({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      overview: movie.overview,
      posterUrl: movie.posterUrl,
      genre: movie.genre,
      watchLinks: JSON.parse(movie.watchLinks),
      debugId
    });

  } catch (error) {
    console.error(`[${debugId}] Movie Identification Error:`, error);
    let message = "TrackTune could not process this movie clip right now. Please try again.";
    if (error?.message?.includes("GEMINI_API_KEY")) {
      message = "Server is missing Gemini AI configuration.";
    }
    return res.status(500).json({ error: message, debugId });
  } finally {
    // Cleanup temporary files from disk
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (e) {}
      }
    }
  }
});

export default router;
