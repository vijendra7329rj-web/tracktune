import { Router } from "express";
import { db } from "../db.js";
import { usersTable } from "../schema.js";
import { eq } from "drizzle-orm";
import axios from "axios";

const router = Router();

router.post("/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "Missing Google credential token." });
  }

  try {
    // Call Google's official verification endpoint
    console.log("Verifying Google ID Token...");
    const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`, {
      timeout: 10000
    });

    const payload = response.data;
    
    // Check client ID audience matching (if configured in env)
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (googleClientId && payload.aud !== googleClientId) {
      console.warn(`Token audience (${payload.aud}) does not match server client ID (${googleClientId})`);
      return res.status(401).json({ error: "Token audience mismatch. Invalid client ID." });
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || "";
    const picture = payload.picture || "";

    if (!googleId || !email) {
      return res.status(400).json({ error: "Invalid token payload from Google." });
    }

    // Find existing user or register new user
    let user = null;
    const existingUsers = await db.select().from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      user = existingUsers[0];
      // Sync profile info if changed
      if (user.googleId !== googleId || user.picture !== picture || user.name !== name) {
        await db.update(usersTable)
          .set({ googleId, name, picture })
          .where(eq(usersTable.email, email));
        user = { ...user, googleId, name, picture };
      }
    } else {
      // Register new user
      const [newUser] = await db.insert(usersTable).values({
        googleId,
        email,
        name,
        picture
      }).returning();
      user = newUser;
    }

    return res.json({
      id: user.id,
      googleId: user.googleId,
      email: user.email,
      name: user.name,
      picture: user.picture
    });

  } catch (error) {
    console.error("Google Token Verification failed:", error.message);
    return res.status(500).json({ error: "Failed to verify Google login. Please try again." });
  }
});

router.get("/auth/config", (req, res) => {
  return res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    adsensePublisherId: process.env.ADSENSE_PUBLISHER_ID || "",
    googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID || ""
  });
});

export default router;
