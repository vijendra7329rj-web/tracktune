const API_BASE_URL = "https://tracktune.onrender.com";
const DAILY_FREE_LIMIT = 5;
const usageKey = `tracktune-usage-${new Date().toISOString().slice(0, 10)}`;

const form = document.querySelector("#identifyForm");
const input = document.querySelector("#videoUrl");
const pasteButton = document.querySelector("#pasteButton");
const identifyButton = document.querySelector("#identifyButton");
const usageLabel = document.querySelector("#usageLabel");
const healthBadge = document.querySelector("#healthBadge");
const loadingState = document.querySelector("#loadingState");
const resultCard = document.querySelector("#resultCard");
const errorCard = document.querySelector("#errorCard");
const errorMessage = document.querySelector("#errorMessage");
const songTitle = document.querySelector("#songTitle");
const songArtist = document.querySelector("#songArtist");
const songAlbum = document.querySelector("#songAlbum");
const spotifyLink = document.querySelector("#spotifyLink");
const youtubeLink = document.querySelector("#youtubeLink");
const artworkBox = document.querySelector("#artworkBox");
const previewWrap = document.querySelector("#previewWrap");
const previewAudio = document.querySelector("#previewAudio");
const resultMeta = document.querySelector("#resultMeta");
const confidenceLabel = document.querySelector("#confidenceLabel");
const sampleLabel = document.querySelector("#sampleLabel");
const debugLabel = document.querySelector("#debugLabel");
const possibleMatches = document.querySelector("#possibleMatches");
const errorDebug = document.querySelector("#errorDebug");
const premiumButton = document.querySelector("#premiumButton");
const premiumModal = document.querySelector("#premiumModal");
const closePremium = document.querySelector("#closePremium");
const modalOkButton = document.querySelector("#modalOkButton");

function getUsedSearches() {
  return Number.parseInt(localStorage.getItem(usageKey) || "0", 10);
}

function setUsedSearches(count) {
  localStorage.setItem(usageKey, String(count));
  updateUsageLabel();
}

function updateUsageLabel() {
  const used = Math.min(getUsedSearches(), DAILY_FREE_LIMIT);
  usageLabel.textContent = `Free searches today: ${used}/${DAILY_FREE_LIMIT}`;
}

function hasFreeSearchLeft() {
  return getUsedSearches() < DAILY_FREE_LIMIT;
}

function incrementUsage() {
  setUsedSearches(getUsedSearches() + 1);
}

function showPremiumModal() {
  premiumModal.classList.remove("hidden");
}

function hidePremiumModal() {
  premiumModal.classList.add("hidden");
}

function setLoading(isLoading) {
  identifyButton.disabled = isLoading;
  identifyButton.classList.toggle("is-loading", isLoading);
  loadingState.classList.toggle("hidden", !isLoading);
}

function hideCards() {
  resultCard.classList.add("hidden");
  errorCard.classList.add("hidden");
}

function showError(message, details = {}) {
  errorMessage.textContent = message;
  errorDebug.textContent = details?.debugId ? `Debug ID: ${details.debugId}` : "";
  errorDebug.classList.toggle("hidden", !details?.debugId);
  errorCard.classList.remove("hidden");
  resultCard.classList.add("hidden");
}

function safeText(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function pickFirstString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "";
}

function formatConfidence(value) {
  const score = Number(value || 0);
  if (!Number.isFinite(score) || score <= 0) return "Confidence: --";
  return `Confidence: ${Math.round(score)}%`;
}

function renderPossibleMatches(matches) {
  if (!Array.isArray(matches) || matches.length <= 1) {
    possibleMatches.classList.add("hidden");
    possibleMatches.innerHTML = "";
    return;
  }

  const items = matches.slice(1, 3).map((match) => {
    const title = safeText(match.title, "Unknown song");
    const artist = safeText(match.artist, "Unknown artist");
    const score = Number(match.score || 0);
    const confidence = Number.isFinite(score) && score > 0 ? ` - ${Math.round(score)}%` : "";
    return `<span>${title} by ${artist}${confidence}</span>`;
  });

  possibleMatches.innerHTML = `<strong>Other possible matches</strong>${items.join("")}`;
  possibleMatches.classList.toggle("hidden", items.length === 0);
}

function renderResult(song) {
  const title = safeText(song.title, "Unknown song");
  const artist = safeText(song.artist, "Unknown artist");
  const album = safeText(song.album, "");
  const artworkUrl = pickFirstString([
    song.artworkUrl,
    song.albumArt,
    song.albumArtwork,
    song.coverUrl,
    song.imageUrl,
  ]);
  const previewUrl = pickFirstString([song.previewUrl, song.previewAudioUrl, song.audioPreviewUrl]);

  songTitle.textContent = title;
  songArtist.textContent = artist;
  songAlbum.textContent = album ? `Album: ${album}` : "Album details are not available yet.";
  confidenceLabel.textContent = formatConfidence(song.confidence);
  sampleLabel.textContent = song.matchedSample ? `Sample: ${song.matchedSample}` : "Sample: --";
  debugLabel.textContent = song.debugId ? `Debug: ${song.debugId.slice(0, 8)}` : "Debug: --";
  resultMeta.classList.remove("hidden");
  renderPossibleMatches(song.possibleMatches);

  spotifyLink.classList.toggle("hidden", !song.spotifyUrl);
  youtubeLink.classList.toggle("hidden", !song.youtubeUrl);

  if (song.spotifyUrl) {
    spotifyLink.href = song.spotifyUrl;
  }

  if (song.youtubeUrl) {
    youtubeLink.href = song.youtubeUrl;
  }

  artworkBox.classList.toggle("has-image", Boolean(artworkUrl));
  artworkBox.style.backgroundImage = artworkUrl ? `url("${artworkUrl}")` : "";

  previewWrap.classList.toggle("hidden", !previewUrl);
  if (previewUrl) {
    previewAudio.src = previewUrl;
  } else {
    previewAudio.removeAttribute("src");
  }

  resultCard.classList.remove("hidden");
  errorCard.classList.add("hidden");
}

function getFriendlyError(error, status) {
  const backendMessage = error?.error || error?.message;

  if (status === 404) {
    return backendMessage || "TrackTune could not find a song in this video. Try another clip with clearer audio.";
  }

  if (status === 429) {
    return "Too many requests right now. Please wait a minute and try again.";
  }

  if (status >= 500) {
    return backendMessage || "The backend had trouble processing this link. Render may be waking up or the video site blocked the download.";
  }

  return backendMessage || "Something went wrong. Please check the URL and try again.";
}

async function identifySong(videoUrl) {
  const response = await fetch(`${API_BASE_URL}/api/identify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: videoUrl }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw {
      status: response.status,
      data,
    };
  }

  return data;
}

async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/healthz`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Health check failed");
    }

    healthBadge.textContent = "API online";
    healthBadge.className = "status-pill status-online";
  } catch {
    healthBadge.textContent = "API waking";
    healthBadge.className = "status-pill status-offline";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const videoUrl = input.value.trim();

  hideCards();

  if (!videoUrl) {
    showError("Paste a public Instagram Reel, YouTube Shorts, TikTok, or video URL first.");
    return;
  }

  try {
    new URL(videoUrl);
  } catch {
    showError("This does not look like a valid URL. Please paste the full link from the video app.");
    return;
  }

  if (!hasFreeSearchLeft()) {
    showPremiumModal();
    showError("You have used 5 free searches today on this device. Premium is coming soon.");
    return;
  }

  setLoading(true);

  try {
    const song = await identifySong(videoUrl);
    incrementUsage();
    renderResult(song);
  } catch (error) {
    const status = error?.status || 0;
    const message =
      status === 0
        ? "Could not reach the backend. Check your internet connection and try again."
        : getFriendlyError(error.data, status);
    showError(message, error.data);
  } finally {
    setLoading(false);
  }
});

pasteButton.addEventListener("click", async () => {
  if (!navigator.clipboard?.readText) {
    input.focus();
    showError("Your browser blocked clipboard access. Tap the URL box and paste manually.");
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    input.value = text.trim();
    input.focus();
  } catch {
    input.focus();
    showError("Clipboard permission was blocked. Tap the URL box and paste manually.");
  }
});

premiumButton.addEventListener("click", showPremiumModal);
closePremium.addEventListener("click", hidePremiumModal);
modalOkButton.addEventListener("click", hidePremiumModal);

premiumModal.addEventListener("click", (event) => {
  if (event.target === premiumModal) {
    hidePremiumModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hidePremiumModal();
  }
});

function loadSharedUrl() {
  const params = new URLSearchParams(window.location.search);
  const sharedUrl = params.get("shared_url") || params.get("url");
  const sharedText = params.get("text") || "";
  const candidate = sharedUrl || sharedText.match(/https?:\/\/\S+/)?.[0] || "";

  if (candidate) {
    input.value = candidate.trim();
    input.focus();
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

updateUsageLabel();
checkBackendHealth();
loadSharedUrl();


