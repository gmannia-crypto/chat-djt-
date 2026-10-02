import type { Express } from "express";
import { HOME_PREVIEW_PERSONAS, getHomePreviewText, normalizePreviewName } from "../shared/home-persona-preview";

// A bounded, short-lived per-IP backstop in addition to the four-clip UI budget.
// This is not account/session authorization and grants no Arena entitlement.
export function registerHomePersonaPreview(
  app: Express,
  synthesize: (personaId: string, text: string) => Promise<Buffer>,
) {
  const buckets = new Map<string, { count: number; expires: number }>();
  app.post("/api/home/persona-preview", async (req, res) => {
    const { personaId, name = "" } = req.body ?? {};
    if (typeof personaId !== "string" || !HOME_PREVIEW_PERSONAS.some((p) => p.id === personaId) ||
        typeof name !== "string" || name.length > 40 ||
        (name !== "" && !/^[\p{L}\p{M} .'-]+$/u.test(name))) {
      return res.status(400).json({ error: "Choose a sample persona and use a name of 40 characters or fewer." });
    }
    const now = Date.now();
    for (const [key, value] of buckets) if (value.expires <= now) buckets.delete(key);
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const bucket = buckets.get(ip) ?? { count: 0, expires: now + 10 * 60_000 };
    if (bucket.count >= 12 || (!buckets.has(ip) && buckets.size >= 5000)) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.expires - now) / 1000))));
      return res.status(429).json({ error: "Preview limit reached. Please try again later." });
    }
    bucket.count++;
    buckets.set(ip, bucket);
    try {
      const text = getHomePreviewText(personaId, normalizePreviewName(name))!;
      const audio = await synthesize(personaId, text);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "private, no-store");
      return res.send(audio);
    } catch {
      return res.status(503).json({ error: "The voice sample is unavailable right now. Please try again." });
    }
  });
}