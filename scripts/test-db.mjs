import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

// Isolated throwaway Postgres, no host port or persistent volume. Docker must be running.
const name = `name-game-rls-${randomUUID().slice(0, 8)}`;
function docker(args, quiet = false) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: quiet ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`docker ${args[0]} failed: ${result.stderr ?? ""}`);
}
let started = false;
try {
  docker([
    "run",
    "--rm",
    "-d",
    "--name",
    name,
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:16-alpine",
  ]);
  started = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      docker(["exec", name, "pg_isready", "-U", "postgres"], true);
      ready = true;
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  if (!ready) throw new Error("PostgreSQL did not become ready");
  for (const [local, remote] of [
    ["tests/db/bootstrap.sql", "bootstrap.sql"],
    ["supabase/migrations/202610280001_initial.sql", "migration.sql"],
    ["supabase/migrations/202610280002_account_deletion.sql", "deletion.sql"],
    ["tests/db/security.sql", "security.sql"],
  ]) {
    docker(["cp", resolve(local), `${name}:/tmp/${remote}`]);
  }
  docker([
    "exec",
    name,
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "/tmp/bootstrap.sql",
    "-f",
    "/tmp/migration.sql",
    "-f",
    "/tmp/deletion.sql",
    "-f",
    "/tmp/security.sql",
  ]);
} finally {
  if (started) docker(["stop", name], true);
}
