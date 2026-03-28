const JDBC_PREFIX = "jdbc:postgresql://";

export function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const domain = process.env.DB_DOMAIN;
  const name = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASS;

  if (!domain || !name || !user || !pass) {
    throw new Error("Missing database environment variables.");
  }

  const host = domain.startsWith(JDBC_PREFIX)
    ? domain.slice(JDBC_PREFIX.length)
    : domain.replace(/^postgresql:\/\//, "");

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${name}`;
}
