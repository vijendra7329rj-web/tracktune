import axios from "axios";
import fs from "fs";
import path from "path";

const youtubeId = "g0yRnTzEuVg"; // The exact video ID from the user's log
const tempDir = "./";
const targetCobalt = path.join(tempDir, "test_cobalt.mp3");
const targetInvidious = path.join(tempDir, "test_invidious.webm");

async function getHealthyInvidiousInstances() {
  try {
    console.log("Fetching dynamic Invidious instances...");
    const response = await axios.get("https://api.invidious.io/instances.json", { timeout: 10000 });
    const instancesData = response.data || [];
    const healthy = instancesData
      .filter(item => {
        const info = item[1];
        return info && info.type === "https" && info.uri && info.monitor && info.monitor.status === "1";
      })
      .map(item => item[1].uri);
      
    if (healthy.length > 0) {
      console.log(`Found ${healthy.length} healthy Invidious instances.`);
      return healthy.slice(0, 8);
    }
  } catch (err) {
    console.warn("Failed to fetch dynamic Invidious instances:", err.message);
  }
  return [
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
    "https://invidious.privacydev.net",
    "https://inv.vern.cc"
  ];
}

async function testCobalt() {
  const instances = [
    "https://cobalt.hyper.us.kg/",
    "https://api.smooth.cafe/",
    "https://cobalt.sh.alby.im/",
    "https://cobalt.foxtrot.us.kg/",
    "https://cobalt.perennial.us.kg/",
    "https://api.cobalt.tools/"
  ];

  console.log("\n--- Testing Cobalt ---");
  for (const instance of instances) {
    try {
      console.log(`Trying Cobalt instance: ${instance}`);
      const response = await axios.post(
        instance,
        {
          url: `https://www.youtube.com/watch?v=${youtubeId}`,
          downloadMode: "audio",
          audioFormat: "mp3"
        },
        {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          timeout: 15000
        }
      );

      const downloadUrl = response.data?.url;
      if (!downloadUrl) {
        throw new Error(`Response had no URL. Body: ${JSON.stringify(response.data)}`);
      }

      console.log(`Found stream URL: ${downloadUrl}`);
      console.log("Downloading audio bytes...");
      const writer = fs.createWriteStream(targetCobalt);
      const streamResponse = await axios({
        method: "get",
        url: downloadUrl,
        responseType: "stream",
        timeout: 30000
      });

      streamResponse.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`Success! Cobalt download completed. File size: ${fs.statSync(targetCobalt).size} bytes`);
      return true;
    } catch (error) {
      console.error(`Cobalt instance ${instance} failed:`, error.message);
    }
  }
  return false;
}

async function testInvidious() {
  const instances = await getHealthyInvidiousInstances();
  console.log("\n--- Testing Invidious ---");
  
  for (const instance of instances) {
    try {
      console.log(`Trying Invidious instance: ${instance}`);
      const infoUrl = `${instance}/api/v1/videos/${youtubeId}`;
      const response = await axios.get(infoUrl, { timeout: 10000 });
      
      const formats = response.data?.adaptiveFormats || [];
      const audioFormats = formats.filter(f => f.type && f.type.startsWith("audio/"));
      
      if (audioFormats.length === 0) {
        throw new Error("No audio stream found in Invidious response");
      }

      audioFormats.sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0));
      const bestAudio = audioFormats[0];
      
      let streamUrl = bestAudio.url;
      if (streamUrl.startsWith("/")) {
        streamUrl = `${instance}${streamUrl}`;
      }
      
      const urlObj = new URL(streamUrl);
      urlObj.searchParams.set("local", "true");
      streamUrl = urlObj.toString();

      console.log(`Found audio stream URL: ${streamUrl}`);
      console.log("Downloading audio bytes...");
      
      const writer = fs.createWriteStream(targetInvidious);
      const streamResponse = await axios({
        method: "get",
        url: streamUrl,
        responseType: "stream",
        timeout: 30000
      });

      streamResponse.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`Success! Invidious download completed. File size: ${fs.statSync(targetInvidious).size} bytes`);
      return true;
    } catch (error) {
      console.error(`Invidious instance ${instance} failed:`, error.message);
    }
  }
  return false;
}

async function run() {
  const cobaltSuccess = await testCobalt();
  const invidiousSuccess = await testInvidious();
  
  // Cleanup test files
  try { if (fs.existsSync(targetCobalt)) fs.unlinkSync(targetCobalt); } catch (e) {}
  try { if (fs.existsSync(targetInvidious)) fs.unlinkSync(targetInvidious); } catch (e) {}
  
  console.log("\n--- TEST SUMMARY ---");
  console.log(`Cobalt: ${cobaltSuccess ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`Invidious: ${invidiousSuccess ? "PASS ✅" : "FAIL ❌"}`);
}

run();
