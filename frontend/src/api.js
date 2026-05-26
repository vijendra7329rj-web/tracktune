export const API_BASE_URL = "https://tracktune.onrender.com";

export async function identifySong(url) {
  const res = await fetch($API_BASE_URL/api/identify, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) throw new Error("Failed to identify song");
  return res.json();
}
