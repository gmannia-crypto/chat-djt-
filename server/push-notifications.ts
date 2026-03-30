import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  }
  return pool;
}

export async function initPushTokensTable() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      expo_push_token TEXT NOT NULL UNIQUE,
      platform TEXT DEFAULT 'unknown',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_pt_device ON push_tokens(device_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_pt_token ON push_tokens(expo_push_token)`);
  console.log("Push tokens table initialized");
}

export function isValidExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

export async function registerPushToken(deviceId: string, expoPushToken: string, platform: string) {
  if (!isValidExpoPushToken(expoPushToken)) {
    throw new Error("Invalid Expo push token format");
  }
  const db = getPool();
  await db.query(
    `INSERT INTO push_tokens (device_id, expo_push_token, platform, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (expo_push_token) DO UPDATE SET device_id = $1, platform = $3, updated_at = NOW()`,
    [deviceId, expoPushToken, platform]
  );
}

export async function unregisterPushToken(expoPushToken: string) {
  const db = getPool();
  await db.query("DELETE FROM push_tokens WHERE expo_push_token = $1", [expoPushToken]);
}

export async function getAllPushTokens(): Promise<string[]> {
  const db = getPool();
  const result = await db.query("SELECT expo_push_token FROM push_tokens ORDER BY updated_at DESC");
  return result.rows.map((r) => r.expo_push_token);
}

export async function getPushTokenCount(): Promise<number> {
  const db = getPool();
  const result = await db.query("SELECT COUNT(*) as count FROM push_tokens");
  return parseInt(result.rows[0]?.count || "0");
}

export async function sendPushNotifications(title: string, body: string): Promise<{ sent: number; failed: number; errors: string[] }> {
  const tokens = await getAllPushTokens();
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, errors: ["No registered push tokens"] };
  }

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default" as const,
    title,
    body,
    data: { type: "admin_notification" },
  }));

  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        failed += chunk.length;
        errors.push(`Expo API returned ${response.status}`);
        continue;
      }

      const result = await response.json() as { data?: Array<{ status: string; message?: string; details?: { error?: string } }> };

      if (!result.data) {
        failed += chunk.length;
        errors.push("Expo API returned unexpected response format");
        continue;
      }

      const tokensToRemove: string[] = [];
      for (let i = 0; i < result.data.length; i++) {
        const ticket = result.data[i];
        if (ticket.status === "ok") {
          sent++;
        } else {
          failed++;
          if (ticket.message) errors.push(ticket.message);
          if (ticket.details?.error === "DeviceNotRegistered") {
            tokensToRemove.push(chunk[i].to);
          }
        }
      }

      if (tokensToRemove.length > 0) {
        for (const token of tokensToRemove) {
          await unregisterPushToken(token).catch(() => {});
        }
        console.log(`Pruned ${tokensToRemove.length} invalid push tokens`);
      }
    } catch (e: any) {
      failed += chunk.length;
      errors.push(e.message || "Unknown error sending chunk");
    }
  }

  return { sent, failed, errors: errors.slice(0, 5) };
}
