// Runs the Supabase migration inside PGlite (Postgres compiled to WASM) with a stubbed
// auth schema, then exercises RLS and the approve_proposal RPC.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const sql = ["0001_init.sql", "0002_sample_data.sql", "0003_keepalive.sql", "0004_trusted_contact_email.sql", "0005_grants.sql"].map((f) => readFileSync(new URL(`../../../supabase/migrations/${f}`, import.meta.url), "utf8")).join("\n");
const db = new PGlite();
await db.exec(`
  create role authenticated nologin;
  create role anon nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
`);
try { await db.exec(sql); } catch (e) { console.error("MIGRATION ERROR:", e.message, e.position ?? ""); process.exit(1); }
// No blanket grants here: the migration itself must give the API roles table access,
// because new Supabase projects no longer do it automatically.

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users(id) values ('${A}'), ('${B}');`);
const as = async (uid, q, params = []) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await db.query(q, params); } finally { await db.exec(`reset role;`); }
};
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok -", m); };

const priv = await db.query(`select bool_and(has_table_privilege('authenticated', 'public.' || t, 'select,insert,update,delete')) ok
  from unnest(array['profiles','consents','chat_sessions','messages','trusted_contacts','audit_log']) t`);
assert(priv.rows[0].ok === true, "migration grants the authenticated role access to app tables");

const prof = await db.query(`select count(*)::int n from public.profiles`);
assert(prof.rows[0].n === 2, "profile trigger creates a profile per auth user");

const s = await as(A, `insert into public.chat_sessions(user_id, title) values ($1, 'A chat') returning id`, [A]);
const sid = s.rows[0].id;
const leak = await as(B, `select * from public.chat_sessions`);
assert(leak.rows.length === 0, "user B cannot read user A's sessions (RLS)");
let blocked = false;
try { await as(B, `insert into public.messages(session_id,user_id,role,content,request_id) values ($1,$2,'user','x','r1')`, [sid, B]); } catch { blocked = true; }
assert(blocked, "user B cannot insert a message into user A's session");

const p = await as(A, `insert into public.proposals(user_id, session_id, type, preview, payload, idempotency_key)
  values ($1,$2,'task_plan','plan','{"tasks":[{"title":"one"}]}','k1') returning id`, [A, sid]);
const pid = p.rows[0].id;
const cross = await as(B, `select public.approve_proposal($1, '{"tasks":[{"title":"hack"}]}') r`, [pid]);
assert(cross.rows[0].r.code === "not_found", "user B cannot approve user A's proposal");
const r1 = await as(A, `select public.approve_proposal($1, '{"tasks":[{"title":"Write outline"},{"title":"Email Sam","due_date":"2026-12-01"}]}') r`, [pid]);
assert(r1.rows[0].r.ok === true && r1.rows[0].r.task_ids.length === 2, "approval creates edited tasks");
const r2 = await as(A, `select public.approve_proposal($1, '{"tasks":[{"title":"again"}]}') r`, [pid]);
const tasks = await as(A, `select count(*)::int n from public.tasks`);
assert(r2.rows[0].r.replayed === true && tasks.rows[0].n === 2, "repeated approve is idempotent (no duplicate tasks)");

const e = await as(A, `insert into public.proposals(user_id, type, preview, payload, idempotency_key, expires_at)
  values ($1,'task_plan','old','{"tasks":[{"title":"x"}]}','k2', now() - interval '1 minute') returning id`, [A]);
const r3 = await as(A, `select public.approve_proposal($1, '{"tasks":[{"title":"x"}]}') r`, [e.rows[0].id]);
const t2 = await as(A, `select count(*)::int n from public.tasks`);
assert(r3.rows[0].r.code === "expired" && t2.rows[0].n === 2, "expired proposal has no side effect");

const m = await as(A, `insert into public.proposals(user_id, type, preview, payload, idempotency_key)
  values ($1,'memory','m','{"summary":"Prefers short replies"}','k3') returning id`, [A]);
const r4 = await as(A, `select public.approve_proposal($1, '{"summary":"Prefers short replies"}') r`, [m.rows[0].id]);
assert(r4.rows[0].r.code === "consent_required", "memory proposal requires memory consent");

const seeded = await as(A, `select public.seed_sample_data() r`);
const sc = await as(A, `select (select count(*) from public.checkins)::int c, (select count(*) from public.journal_entries)::int j`);
assert(seeded.rows[0].r.ok && sc.rows[0].c === 15 && sc.rows[0].j === 2, "sample data seeds 15 check-ins with gaps and 2 journal entries");
const bLeak = await as(B, `select count(*)::int n from public.checkins`);
assert(bLeak.rows[0].n === 0, "sample data is only visible to its owner");
await as(A, `select public.remove_sample_data()`);
const sr = await as(A, `select (select count(*) from public.checkins)::int c, (select count(*) from public.tasks where title like '(sample)%')::int t`);
assert(sr.rows[0].c === 0 && sr.rows[0].t === 0, "sample data can be removed completely");

await db.exec(`grant usage on schema public to anon;`);
await db.exec(`set role anon;`);
const beat = await db.query(`select public.keepalive() t`);
await db.exec(`reset role;`);
assert(beat.rows[0].t instanceof Date, "keepalive() works for the anonymous role and touches the database");
let anonBlocked = false;
await db.exec(`set role anon;`);
try { await db.query(`select * from public.heartbeat`); } catch { anonBlocked = true; }
await db.exec(`reset role;`);
assert(anonBlocked, "anonymous role cannot read tables directly");

await db.exec(`set role anon;`);
let anonProfiles = false;
try { await db.query(`select * from public.profiles`); } catch { anonProfiles = true; }
await db.exec(`reset role;`);
assert(anonProfiles, "signed-out visitors cannot read app tables");

await as(A, `insert into public.profiles(id, display_name, country, timezone, default_mode, adult_confirmed, onboarded_at)
  values ($1, 'Kenil', 'IN', 'Asia/Kolkata', 'just_listen', true, now())
  on conflict (id) do update set display_name = excluded.display_name, onboarded_at = excluded.onboarded_at`, [A]);
await as(A, `insert into public.consents(user_id, consent_type, granted) values ($1, 'memory', true), ($1, 'insights', true)
  on conflict (user_id, consent_type) do update set granted = excluded.granted`, [A]);
const onb = await as(A, `select onboarded_at is not null done from public.profiles where id = $1`, [A]);
assert(onb.rows[0]?.done === true, "onboarding writes (profile + consents upsert) succeed for a signed-in user");

await as(A, `insert into public.trusted_contacts(user_id, name, email) values ($1, 'Sam', 'sam@example.com')`, [A]);
const tc = await as(B, `select count(*)::int n from public.trusted_contacts`);
assert(tc.rows[0].n === 0, "trusted contacts (with email) are private to their owner");

await db.exec(`delete from auth.users where id = '${A}'`);
const left = await db.query(`select (select count(*) from public.tasks)::int t, (select count(*) from public.chat_sessions)::int s, (select count(*) from public.proposals)::int p`);
assert(left.rows[0].t === 0 && left.rows[0].s === 0 && left.rows[0].p === 0, "account deletion cascades to all user rows");
console.log("migration checks passed");
