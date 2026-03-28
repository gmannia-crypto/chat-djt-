import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  }
  return pool;
}

export async function initAnalyticsTables() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS page_views (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      screen TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS feature_events (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      feature TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      name TEXT DEFAULT '',
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      admin_note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_pv_screen ON page_views(screen)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_fe_feature ON feature_events(feature)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_sug_status ON suggestions(status)`);
  console.log("Analytics & suggestions tables initialized");
}

export async function trackPageView(deviceId: string, screen: string, durationSeconds: number) {
  const db = getPool();
  await db.query(
    "INSERT INTO page_views (device_id, screen, duration_seconds) VALUES ($1, $2, $3)",
    [deviceId, screen, durationSeconds]
  );
}

export async function trackFeatureEvent(deviceId: string, feature: string, action: string, metadata: any = {}) {
  const db = getPool();
  await db.query(
    "INSERT INTO feature_events (device_id, feature, action, metadata) VALUES ($1, $2, $3, $4)",
    [deviceId, feature, action, JSON.stringify(metadata)]
  );
}

export async function submitSuggestion(deviceId: string, name: string, message: string) {
  const db = getPool();
  await db.query(
    "INSERT INTO suggestions (device_id, name, message) VALUES ($1, $2, $3)",
    [deviceId, name, message]
  );
}

export async function getAnalyticsSummary(days: number = 30) {
  const db = getPool();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [visitors, pageViews, topScreens, topFeatures, dailyVisitors, suggestions] = await Promise.all([
    db.query("SELECT COUNT(DISTINCT device_id) as count FROM page_views WHERE created_at >= $1", [since]),
    db.query("SELECT COUNT(*) as count FROM page_views WHERE created_at >= $1", [since]),
    db.query(`
      SELECT screen, COUNT(*) as views, COUNT(DISTINCT device_id) as unique_visitors,
        COALESCE(AVG(duration_seconds), 0) as avg_duration,
        COALESCE(SUM(duration_seconds), 0) as total_time
      FROM page_views WHERE created_at >= $1
      GROUP BY screen ORDER BY views DESC LIMIT 20
    `, [since]),
    db.query(`
      SELECT feature, action, COUNT(*) as count, COUNT(DISTINCT device_id) as unique_users
      FROM feature_events WHERE created_at >= $1
      GROUP BY feature, action ORDER BY count DESC LIMIT 30
    `, [since]),
    db.query(`
      SELECT DATE(created_at) as day, COUNT(DISTINCT device_id) as visitors, COUNT(*) as views
      FROM page_views WHERE created_at >= $1
      GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 30
    `, [since]),
    db.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'new') as unread FROM suggestions"),
  ]);

  return {
    uniqueVisitors: parseInt(visitors.rows[0]?.count || "0"),
    totalPageViews: parseInt(pageViews.rows[0]?.count || "0"),
    topScreens: topScreens.rows.map(r => ({
      screen: r.screen,
      views: parseInt(r.views),
      uniqueVisitors: parseInt(r.unique_visitors),
      avgDuration: Math.round(parseFloat(r.avg_duration)),
      totalTime: parseInt(r.total_time),
    })),
    topFeatures: topFeatures.rows.map(r => ({
      feature: r.feature,
      action: r.action,
      count: parseInt(r.count),
      uniqueUsers: parseInt(r.unique_users),
    })),
    dailyVisitors: dailyVisitors.rows.map(r => ({
      day: r.day,
      visitors: parseInt(r.visitors),
      views: parseInt(r.views),
    })),
    suggestions: {
      total: parseInt(suggestions.rows[0]?.total || "0"),
      unread: parseInt(suggestions.rows[0]?.unread || "0"),
    },
  };
}

export async function getSuggestions(limit: number = 50, offset: number = 0) {
  const db = getPool();
  const result = await db.query(
    "SELECT * FROM suggestions ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset]
  );
  return result.rows;
}

export async function updateSuggestionStatus(id: number, status: string, adminNote: string = "") {
  const db = getPool();
  await db.query(
    "UPDATE suggestions SET status = $1, admin_note = $2 WHERE id = $3",
    [status, adminNote, id]
  );
}
