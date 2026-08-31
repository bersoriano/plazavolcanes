import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const workdir = process.cwd();
const sellerId = "f1000000-0000-4000-8000-000000000001";

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: workdir,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${commandName} failed`);
  }
  return result.stdout.trim();
}

const containers = command("docker", [
  "ps",
  "--filter",
  `label=com.supabase.cli.workdir=${workdir}`,
  "--format",
  "{{.Names}}",
])
  .split("\n")
  .filter(Boolean);
const databaseContainer = containers.find((name) => name.startsWith("supabase_db_"));
assert.ok(databaseContainer, "Start the local Supabase stack before running this proof.");

const psqlArgs = [
  "exec",
  "-i",
  databaseContainer,
  "psql",
  "-X",
  "-q",
  "-A",
  "-t",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "postgres",
  "-d",
  "postgres",
];

function psql(sql) {
  return command("docker", psqlArgs, { input: sql });
}

function concurrentCreate(applicationName, slug) {
  const child = spawn("docker", psqlArgs, {
    cwd: workdir,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  const completion = new Promise((resolve) => {
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10_000);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });

  child.stdin.end(`
set application_name = '${applicationName}';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '${sellerId}';
insert into public.shops (owner_id, name, slug, description)
values (
  '${sellerId}',
  'Tienda concurrente',
  '${slug}',
  'Descripción suficientemente larga para probar creación concurrente.'
);
commit;
`);
  return completion;
}

async function waitForLock(applicationName, granted) {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const count = Number(psql(`
      select count(*)
      from pg_catalog.pg_locks locks
      join pg_catalog.pg_stat_activity activity on activity.pid = locks.pid
      where activity.application_name = '${applicationName}'
        and locks.locktype = 'advisory'
        and locks.granted is ${granted ? "true" : "false"};
    `));
    if (count === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    `${applicationName} never ${granted ? "acquired" : "waited on"} the advisory lock`,
  );
}

const setup = `
begin;
insert into auth.users (id, email, created_at)
values ('${sellerId}', 'shop-limit-concurrency@test.local', now());
create function private.test_shop_limit_pause()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id = '${sellerId}'::uuid then
    perform pg_catalog.pg_sleep(2);
  end if;
  return new;
end;
$$;
create trigger test_shop_limit_pause
before insert on public.shops
for each row execute function private.test_shop_limit_pause();
commit;
`;

const cleanup = `
begin;
drop trigger if exists test_shop_limit_pause on public.shops;
drop function if exists private.test_shop_limit_pause();
delete from public.shops where owner_id = '${sellerId}';
delete from auth.users where id = '${sellerId}';
commit;
`;

try {
  psql(setup);

  const first = concurrentCreate("shop_limit_concurrency_first", "concurrente-uno");
  await waitForLock("shop_limit_concurrency_first", true);
  const second = concurrentCreate("shop_limit_concurrency_second", "concurrente-dos");
  await waitForLock("shop_limit_concurrency_second", false);

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.code, 0, firstResult.stderr);
  assert.notEqual(secondResult.code, 0, "second concurrent create must be rejected");
  assert.match(secondResult.stderr, /Alcanzaste el límite de tiendas\./);

  const shopCount = Number(psql(`
    select count(*) from public.shops where owner_id = '${sellerId}';
  `));
  assert.equal(shopCount, 1, "concurrent creates must leave exactly one shop");

  console.log("PASS concurrent shop creates serialized and exactly one succeeded");
} finally {
  psql(cleanup);
}
