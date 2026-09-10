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
  // Add utm_source column if it doesn't exist yet (idempotent migration)
  await db.query(`ALTER TABLE page_views ADD COLUMN IF NOT EXISTS utm_source TEXT`);
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

export async function trackPageView(deviceId: string, screen: string, durationSeconds: number, utmSource?: string) {
  const db = getPool();
  await db.query(
    "INSERT INTO page_views (device_id, screen, duration_seconds, utm_source) VALUES ($1, $2, $3, $4)",
    [deviceId, screen, durationSeconds, utmSource || null]
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

export async function getLeadGenStats(days: number = 30) {
  const db = getPool();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [result, dailyResult] = await Promise.all([
    db.query(`
      SELECT
        COALESCE(metadata->>'community', 'unknown') AS community,
        action,
        COUNT(*) AS count
      FROM feature_events
      WHERE feature = 'lead_gen'
        AND action IN ('copy', 'share')
        AND created_at >= $1
      GROUP BY community, action
      ORDER BY community, action
    `, [since]),
    db.query(`
      SELECT
        DATE(created_at) AS day,
        COALESCE(metadata->>'community', 'unknown') AS community,
        SUM(CASE WHEN action = 'copy'  THEN 1 ELSE 0 END) AS copies,
        SUM(CASE WHEN action = 'share' THEN 1 ELSE 0 END) AS shares
      FROM feature_events
      WHERE feature = 'lead_gen'
        AND action IN ('copy', 'share')
        AND created_at >= $1
      GROUP BY DATE(created_at), COALESCE(metadata->>'community', 'unknown')
      ORDER BY day ASC
    `, [since]),
  ]);

  // Pivot into per-community {community, copies, shares} rows
  const map = new Map<string, { community: string; copies: number; shares: number }>();
  for (const row of result.rows) {
    const key = row.community as string;
    if (!map.has(key)) map.set(key, { community: key, copies: 0, shares: 0 });
    const entry = map.get(key)!;
    if (row.action === "copy")  entry.copies  = parseInt(row.count);
    if (row.action === "share") entry.shares  = parseInt(row.count);
  }

  // Sort by total (copies + shares) descending
  const communities = Array.from(map.values()).sort(
    (a, b) => (b.copies + b.shares) - (a.copies + a.shares)
  );

  // Daily breakdown per-community — frontend aggregates or filters as needed
  const dailyBreakdown = dailyResult.rows.map(r => ({
    day:       String(r.day).slice(0, 10),
    community: r.community as string,
    copies:    parseInt(r.copies)  || 0,
    shares:    parseInt(r.shares)  || 0,
  }));

  return { communities, dailyBreakdown };
}

/**
 * Bonus mini-game engagement, broken down by game type (e.g. "putting", "threePoint").
 * Sourced from feature_events rows written via the shared bonus-game convention
 * (see trackBonusGame in lib/use-analytics.ts): a feature="bonus_game" event with
 * metadata.game set to a stable id, and action one of "started" (offer tapped),
 * "completed" (attempt scored, with an outcome), or "forfeited" (closed early
 * without finishing). Any mini-game that emits this event shape is picked up here
 * automatically — no server-side registration of game ids is needed.
 */
export async function getBonusGameStats(days: number = 30) {
  const db = getPool();
  const now = Date.now();
  const since = new Date(now - days * 86400000).toISOString();
  // Prior period of equal length, immediately preceding `since`, for period-over-period deltas.
  const prevSince = new Date(now - 2 * days * 86400000).toISOString();

  const [byGameRes, outcomeRes, prevByGameRes] = await Promise.all([
    db.query(`
      SELECT
        metadata->>'game' AS game,
        COUNT(*) FILTER (WHERE action = 'started')   AS started,
        COUNT(*) FILTER (WHERE action = 'completed') AS completed,
        COUNT(*) FILTER (WHERE action = 'forfeited') AS forfeited
      FROM feature_events
      WHERE feature = 'bonus_game' AND created_at >= $1
      GROUP BY metadata->>'game'
    `, [since]),
    db.query(`
      SELECT metadata->>'game' AS game, metadata->>'outcome' AS outcome, COUNT(*) AS count
      FROM feature_events
      WHERE feature = 'bonus_game' AND action = 'completed' AND created_at >= $1
      GROUP BY metadata->>'game', metadata->>'outcome'
      ORDER BY game, count DESC
    `, [since]),
    // Immediately preceding period of the same length, for period-over-period comparison.
    db.query(`
      SELECT
        metadata->>'game' AS game,
        COUNT(*) FILTER (WHERE action = 'started')   AS started,
        COUNT(*) FILTER (WHERE action = 'completed') AS completed,
        COUNT(*) FILTER (WHERE action = 'forfeited') AS forfeited
      FROM feature_events
      WHERE feature = 'bonus_game' AND created_at >= $1 AND created_at < $2
      GROUP BY metadata->>'game'
    `, [prevSince, since]),
  ]);

  const games = byGameRes.rows
    .filter(r => !!r.game)
    .map(r => {
      const started = parseInt(r.started) || 0;
      const completed = parseInt(r.completed) || 0;
      const forfeited = parseInt(r.forfeited) || 0;
      return {
        game: r.game as string,
        started,
        completed,
        forfeited,
        completionRate: started > 0 ? Math.round((completed / started) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.started - a.started);

  const outcomesByGame = new Map<string, { outcome: string; count: number }[]>();
  for (const row of outcomeRes.rows) {
    if (!row.game || !row.outcome) continue;
    if (!outcomesByGame.has(row.game)) outcomesByGame.set(row.game, []);
    outcomesByGame.get(row.game)!.push({ outcome: row.outcome, count: parseInt(row.count) || 0 });
  }

  const prevByGame = new Map<string, { started: number; completed: number; completionRate: number }>();
  for (const row of prevByGameRes.rows) {
    if (!row.game) continue;
    const started = parseInt(row.started) || 0;
    const completed = parseInt(row.completed) || 0;
    prevByGame.set(row.game, {
      started,
      completed,
      completionRate: started > 0 ? Math.round((completed / started) * 1000) / 10 : 0,
    });
  }

  // Period-over-period trend: current window vs. the immediately preceding window of equal
  // length, per game. `startedDeltaPct` is null when the prior period had zero starts (no
  // meaningful percent change to report).
  const trendGames = games.map(g => {
    const prev = prevByGame.get(g.game) || { started: 0, completed: 0, completionRate: 0 };
    const startedDeltaPct = prev.started > 0
      ? Math.round(((g.started - prev.started) / prev.started) * 1000) / 10
      : null;
    return {
      game: g.game,
      started: g.started,
      previousStarted: prev.started,
      startedDeltaPct,
      completionRate: g.completionRate,
      previousCompletionRate: prev.completionRate,
      completionRateDelta: Math.round((g.completionRate - prev.completionRate) * 10) / 10,
    };
  });

  // A single plain-language callout surfacing the most actionable signal, so admins deciding
  // which mini-game variant to build next don't have to eyeball the tables themselves.
  let headline: string | null = null;
  if (games.length >= 2) {
    const [top, second] = games;
    if (top.started > 0 && second.started > 0) {
      const completionGap = Math.round((top.completionRate - second.completionRate) * 10) / 10;
      if (Math.abs(completionGap) >= 5) {
        const winner = completionGap > 0 ? top : second;
        const loser = completionGap > 0 ? second : top;
        headline = `${BONUS_GAME_LABELS[winner.game] || winner.game} has a ${Math.abs(completionGap)}% higher completion rate than ${BONUS_GAME_LABELS[loser.game] || loser.game} over the last ${days} days.`;
      }
    }
  } else if (games.length === 1 && games[0].started > 0) {
    const trend = trendGames[0];
    if (trend.startedDeltaPct !== null && Math.abs(trend.startedDeltaPct) >= 10) {
      const direction = trend.startedDeltaPct > 0 ? "up" : "down";
      headline = `${BONUS_GAME_LABELS[trend.game] || trend.game} plays are ${direction} ${Math.abs(trend.startedDeltaPct)}% vs. the previous ${days} days.`;
    }
  }
  if (!headline) {
    const biggestMover = [...trendGames]
      .filter(t => t.startedDeltaPct !== null)
      .sort((a, b) => Math.abs(b.startedDeltaPct as number) - Math.abs(a.startedDeltaPct as number))[0];
    if (biggestMover && Math.abs(biggestMover.startedDeltaPct as number) >= 15) {
      const direction = (biggestMover.startedDeltaPct as number) > 0 ? "up" : "down";
      headline = `${BONUS_GAME_LABELS[biggestMover.game] || biggestMover.game} plays are ${direction} ${Math.abs(biggestMover.startedDeltaPct as number)}% vs. the previous ${days} days.`;
    }
  }

  // Ranked "build next" recommendation across all reporting variants, blending three signals
  // rather than just the top-2 completion-rate gap: starts share (popularity), completion rate
  // (quality of the experience), and recent trend direction (momentum). Works from 2 variants
  // up — today's app already has 2 (putting, threePoint) — and scales cleanly as more are added.
  const eligible = games.filter(g => g.started > 0);
  let recommendation: {
    ranking: {
      game: string;
      score: number;
      startsShare: number;
      completionRate: number;
      trendScore: number;
    }[];
    reason: string;
  } | null = null;

  if (eligible.length >= 2) {
    const totalStartedAll = eligible.reduce((sum, g) => sum + g.started, 0);
    const maxCompletionRate = Math.max(...eligible.map(g => g.completionRate), 1);

    const ranking = eligible
      .map(g => {
        const trend = trendGames.find(t => t.game === g.game);
        const hasPriorPeriod = !!trend && trend.previousStarted > 0;
        const startsShare = totalStartedAll > 0 ? Math.round((g.started / totalStartedAll) * 1000) / 10 : 0;
        // Trend direction folds in both starts momentum and completion-rate momentum, each
        // clamped to +/-50% so a single outlier period can't dominate the blended score.
        // Both are treated as neutral (0) when there's no prior-period data to compare
        // against — a brand-new variant shouldn't look like it's "trending up" just because
        // its completion rate is being compared against an artificial 0% baseline.
        const startedMomentum = hasPriorPeriod && trend!.startedDeltaPct !== null
          ? Math.max(-50, Math.min(50, trend!.startedDeltaPct))
          : 0;
        const completionMomentum = hasPriorPeriod
          ? Math.max(-50, Math.min(50, trend!.completionRateDelta * 5))
          : 0;
        const trendScore = Math.round(((startedMomentum + completionMomentum) / 2 + 50));

        const startsShareNorm = totalStartedAll > 0 ? (g.started / totalStartedAll) * 100 : 0;
        const completionRateNorm = (g.completionRate / maxCompletionRate) * 100;
        // Weighted blend: popularity and quality matter most for "what to build more of";
        // momentum is a smaller tiebreaker signal on top of the current snapshot.
        const score = Math.round(
          startsShareNorm * 0.4 + completionRateNorm * 0.4 + trendScore * 0.2
        );

        return {
          game: g.game,
          score,
          startsShare,
          completionRate: g.completionRate,
          trendScore,
        };
      })
      .sort((a, b) => b.score - a.score);

    const winner = ranking[0];
    const winnerLabel = BONUS_GAME_LABELS[winner.game] || winner.game;
    const momentumNote = winner.trendScore > 55
      ? "and trending up"
      : winner.trendScore < 45
        ? "though momentum has cooled recently"
        : "with steady momentum";
    recommendation = {
      ranking,
      reason: `${winnerLabel} leads the blended score (${winner.startsShare}% of starts, ${winner.completionRate}% completion, ${momentumNote}) — the clearest pick to invest in next.`,
    };
  }

  return {
    games,
    outcomes: Object.fromEntries(outcomesByGame),
    trend: {
      days,
      games: trendGames,
      headline,
    },
    recommendation,
  };
}

const BONUS_GAME_LABELS: Record<string, string> = {
  putting: "Putting",
  threePoint: "3-Pointer",
};

export async function getVisitorStats(leadGenDays: number = 30) {
  const db = getPool();

  const [
    todayRes, yesterdayRes, weekRes, allTimeRes,
    onlineNowRes, newTodayRes, dailyRes, todayBySourceRes,
    leadGenRes,
  ] = await Promise.all([
    // Today
    db.query(`SELECT COUNT(DISTINCT device_id) AS count FROM page_views WHERE created_at >= CURRENT_DATE`),
    // Yesterday
    db.query(`SELECT COUNT(DISTINCT device_id) AS count FROM page_views
              WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE`),
    // Last 7 days
    db.query(`SELECT COUNT(DISTINCT device_id) AS count FROM page_views
              WHERE created_at >= NOW() - INTERVAL '7 days'`),
    // All time
    db.query(`SELECT COUNT(DISTINCT device_id) AS count FROM page_views`),
    // Online now: last_seen in token_accounts within past 5 minutes
    db.query(`SELECT COUNT(*) AS count FROM token_accounts
              WHERE last_seen > NOW() - INTERVAL '5 minutes'`)
      .catch(() => ({ rows: [{ count: "0" }] })),
    // New visitors today: first page_view ever is today
    db.query(`SELECT COUNT(*) AS count FROM (
                SELECT device_id FROM page_views
                GROUP BY device_id HAVING MIN(created_at) >= CURRENT_DATE
              ) AS new_today`),
    // Daily bar chart — last 14 days
    db.query(`SELECT DATE(created_at) AS day,
                     COUNT(DISTINCT device_id) AS visitors,
                     COUNT(*) AS views
              FROM page_views
              WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
              GROUP BY DATE(created_at)
              ORDER BY day DESC`),
    // Today's visitors broken down by utm_source
    db.query(`SELECT COALESCE(utm_source, 'direct') AS source,
                     COUNT(DISTINCT device_id) AS visitors
              FROM page_views
              WHERE created_at >= CURRENT_DATE AND utm_source IS NOT NULL
              GROUP BY utm_source
              ORDER BY visitors DESC`),
    // Lead gen community activity
    getLeadGenStats(leadGenDays),
  ]);

  return {
    today:     parseInt(todayRes.rows[0]?.count     || "0"),
    yesterday: parseInt(yesterdayRes.rows[0]?.count || "0"),
    week:      parseInt(weekRes.rows[0]?.count      || "0"),
    allTime:   parseInt(allTimeRes.rows[0]?.count   || "0"),
    onlineNow: parseInt(onlineNowRes.rows[0]?.count || "0"),
    newToday:  parseInt(newTodayRes.rows[0]?.count  || "0"),
    daily: dailyRes.rows.map(r => ({
      day:      r.day,
      visitors: parseInt(r.visitors),
      views:    parseInt(r.views),
    })),
    todayBySource: todayBySourceRes.rows.map(r => ({
      source:   r.source,
      visitors: parseInt(r.visitors),
    })),
    leadGen: leadGenRes,
  };
}
