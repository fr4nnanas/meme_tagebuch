const DAY_MS = 24 * 60 * 60 * 1000;

function parseEnvDate(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function shouldShowInterimWelcomeBanner(createdAt: string): boolean {
  if (process.env.NEXT_PUBLIC_INTERIM_WELCOME_BANNER === "false") {
    return false;
  }

  if (process.env.NEXT_PUBLIC_INTERIM_WELCOME_BANNER === "always") {
    return true;
  }

  const createdAtMs = Date.parse(createdAt);
  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  const interimStartMs = parseEnvDate(
    process.env.NEXT_PUBLIC_INTERIM_APP_START,
  );
  if (interimStartMs !== null) {
    return createdAtMs >= interimStartMs;
  }

  const maxAgeDays = Number.parseInt(
    process.env.NEXT_PUBLIC_INTERIM_WELCOME_MAX_ACCOUNT_AGE_DAYS ?? "120",
    10,
  );
  const ageDays = (Date.now() - createdAtMs) / DAY_MS;
  return ageDays <= maxAgeDays;
}
