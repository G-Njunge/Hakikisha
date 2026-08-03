// Managed Postgres (Render, Railway, RDS, etc.) requires SSL on its public
// connection string but presents a cert not chained to a public CA, hence
// rejectUnauthorized: false. Local Postgres neither needs nor supports this,
// so it's decided from the connection string's host rather than NODE_ENV
// (unreliable across providers), to avoid breaking local dev.
//
// A plain function rather than a shared Pool export — pool.ts, seed.ts,
// migrate.ts, and reset.ts each need their own Pool anyway (the latter three
// run standalone, before their own dotenv.config() call would have
// populated DATABASE_URL if importing pool.ts's already-constructed Pool
// triggered its top-level `new Pool(...)` too early via import hoisting).
export function sslConfigFor(connectionString: string | undefined): { rejectUnauthorized: boolean } | undefined {
  const isLocalDb = /localhost|127\.0\.0\.1/.test(connectionString ?? "");
  return isLocalDb ? undefined : { rejectUnauthorized: false };
}
