const DEFAULT_RETENTION_DAYS = 7;
const DEFAULT_CLEANUP_INTERVAL_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[cleanup] Invalid value for ${name}=${JSON.stringify(raw)}, falling back to default ${fallback}`,
    );
    return fallback;
  }
  return parsed;
}

export const INTERVIEW_RETENTION_DAYS = readPositiveNumberEnv(
  "INTERVIEW_RETENTION_DAYS",
  DEFAULT_RETENTION_DAYS,
);

export const INTERVIEW_CLEANUP_INTERVAL_HOURS = readPositiveNumberEnv(
  "INTERVIEW_CLEANUP_INTERVAL_HOURS",
  DEFAULT_CLEANUP_INTERVAL_HOURS,
);

export const INTERVIEW_RETENTION_MS = INTERVIEW_RETENTION_DAYS * DAY_MS;
export const CLEANUP_INTERVAL_MS = INTERVIEW_CLEANUP_INTERVAL_HOURS * HOUR_MS;

export const INTERVIEW_CLEANUP_DISABLED: boolean = (() => {
  const raw = process.env["INTERVIEW_CLEANUP_DISABLED"];
  return raw === "1" || raw === "true" || raw === "yes";
})();
