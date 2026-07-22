import { Pool } from "pg";

// Managed Postgres (Railway, RDS, etc.) requires SSL on its public connection
// string but presents a cert not chained to a public CA, hence
// rejectUnauthorized: false. Local Postgres neither needs nor supports this,
// so it's skipped based on the host rather than NODE_ENV (which Railway
// doesn't reliably set) to avoid breaking local dev.
const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});

export default pool;
