import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const workdir = process.cwd();
const buyerId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const sellerId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const idempotencyKey = "dddddddd-0000-4000-8000-000000000001";
const shopId = 930;
const productId = 830;

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

function concurrentCheckout(applicationName) {
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
set local request.jwt.claim.sub = '${buyerId}';
select public.checkout_cart_v3(
  ${shopId}, 'pickup', null, null, null, '${idempotencyKey}'::uuid
);
commit;
`);
  return completion;
}

const setup = `
begin;
insert into auth.users (id, email, created_at) values
  ('${buyerId}', 'concurrent-buyer@test.local', now()),
  ('${sellerId}', 'concurrent-seller@test.local', now());
insert into public.shops (id, owner_id, name, slug, description, country_code, time_zone)
overriding system value
values (${shopId}, '${sellerId}', 'Tienda Concurrente', 'tienda-concurrente',
  'Descripción completa para probar dos solicitudes simultáneas.', 'MX',
  'America/Mexico_City');
insert into public.products
  (id, shop_id, name, description, price_mxn, status, units_available, category_id)
overriding system value
values (
  ${productId}, ${shopId}, 'Taza concurrente',
  'Descripción completa de la taza usada en la prueba concurrente.',
  250, 'published', 5,
  (select id from public.categories where slug = 'celulares-y-accesorios')
);
insert into public.carts (id, buyer_id, shop_id)
overriding system value
values (${shopId}, '${buyerId}', ${shopId});
insert into public.cart_items (id, cart_id, product_id, quantity)
overriding system value
values (${shopId}, ${shopId}, ${productId}, 1);
create function private.test_checkout_idempotency_pause()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.idempotency_key = '${idempotencyKey}'::uuid then
    perform pg_catalog.pg_sleep(2);
  end if;
  return new;
end;
$$;
create trigger test_checkout_idempotency_pause
before insert on public.orders
for each row execute function private.test_checkout_idempotency_pause();
commit;
`;

const cleanup = `
begin;
drop trigger if exists test_checkout_idempotency_pause on public.orders;
drop function if exists private.test_checkout_idempotency_pause();
delete from public.buyer_response_events where buyer_id = '${buyerId}';
delete from public.buyer_activity_events where buyer_id = '${buyerId}';
delete from public.seller_response_events where shop_id = ${shopId};
delete from public.seller_activity_events where shop_id = ${shopId};
delete from public.conversations where buyer_id = '${buyerId}' and shop_id = ${shopId};
delete from public.order_events where order_id in (
  select id from public.orders where buyer_id = '${buyerId}'
);
delete from public.order_addresses where order_id in (
  select id from public.orders where buyer_id = '${buyerId}'
);
delete from public.order_items where order_id in (
  select id from public.orders where buyer_id = '${buyerId}'
);
delete from public.orders where buyer_id = '${buyerId}';
delete from public.carts where buyer_id = '${buyerId}' and shop_id = ${shopId};
delete from public.products where id = ${productId};
delete from public.shops where id = ${shopId};
delete from auth.users where id in ('${buyerId}', '${sellerId}');
commit;
`;

try {
  psql(setup);

  const first = concurrentCheckout("checkout_concurrency_first");
  await new Promise((resolve) => setTimeout(resolve, 250));
  const second = concurrentCheckout("checkout_concurrency_second");
  await new Promise((resolve) => setTimeout(resolve, 350));

  const advisoryWaiters = Number(psql(`
    select count(*)
    from pg_catalog.pg_locks locks
    join pg_catalog.pg_stat_activity activity on activity.pid = locks.pid
    where activity.application_name = 'checkout_concurrency_second'
      and locks.locktype = 'advisory'
      and not locks.granted;
  `));

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(advisoryWaiters, 1, "the second checkout must wait on the buyer/key advisory lock");
  assert.equal(firstResult.code, 0, firstResult.stderr);
  assert.equal(secondResult.code, 0, secondResult.stderr);
  assert.match(firstResult.stdout, /^\d+$/);
  assert.equal(secondResult.stdout, firstResult.stdout, "both sessions must receive the same order id");

  const orderCount = Number(psql(`
    select count(*) from public.orders
    where buyer_id = '${buyerId}' and idempotency_key = '${idempotencyKey}';
  `));
  assert.equal(orderCount, 1, "concurrent retries must create exactly one order");

  console.log(`PASS concurrent checkout replay returned order ${firstResult.stdout} once`);
} finally {
  psql(cleanup);
}
