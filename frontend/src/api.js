export const API_BASE_URL = "https://tracktune.onrender.com";

export async function identifySong(url) {
  const res = await fetch(`${API_BASE_URL}/api/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to identify song");
  }
  return res.json();
}

export async function identifySongFromAudio(audioBlob) {
  const res = await fetch(`${API_BASE_URL}/api/identify-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: audioBlob
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to identify song from microphone.");
  }
  return res.json();
}

export async function loginWithGoogle(credential) {
  const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to log in with Google.");
  }
  return res.json();
}

export async function getAuthConfig() {
  const res = await fetch(`${API_BASE_URL}/api/auth/config`);
  if (!res.ok) {
    throw new Error("Failed to load auth configuration.");
  }
  return res.json();
}
