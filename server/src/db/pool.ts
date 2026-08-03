import { Pool } from "pg";
import { sslConfigFor } from "./sslConfig";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfigFor(process.env.DATABASE_URL),
});

export default pool;
