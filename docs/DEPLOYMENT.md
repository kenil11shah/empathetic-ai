# Empathetic AI — Deployment Guide

How to take this repository live on free tiers using only a browser: Supabase for the database and sign-in, Groq for the AI, and Vercel for hosting.

**Time:** about 45 minutes. **Cost:** ₹0 on free tiers.

## How this works

| Step | Who | Where |
| --- | --- | --- |
| 1. Create the database | You | supabase.com |
| 2. Get the AI key | You | console.groq.com |
| 3. Put the code on GitHub | You | github.com |
| 4. Go live with the real AI connected | You | vercel.com |
| 5. Test it | You (later pushes redeploy the site by themselves) | Your new URL |
| 6. Share it | You | LinkedIn, portfolio |

Use the browser profile that is signed in to your own GitHub account.

While you work, keep a private note open (Google Keep, Notes, anything) to paste the keys you collect. You'll need them in Part 4. Never post them anywhere public.

## Always on, by design

The live site stays usable 24/7 for anyone who opens it from your portfolio or LinkedIn. None of this needs you to do anything.

| What could stop it | What keeps it running (built in) |
| --- | --- |
| Supabase pauses free databases after 7 days of low activity | A daily job, set up automatically by Vercel (`apps/web/vercel.json`), pings the database every day so it never looks inactive |
| Guest accounts piling up and filling the free database | The same daily job deletes guest accounts older than 30 days. People who sign up with an email keep their account and can sign in again any time |
| Groq's free daily limit on one AI model | When one model hits its limit, the app switches to the next free Groq model (four in the chain, each with its own daily quota) |
| Every model busy at once | The app still answers with a simpler built-in reply instead of an error. Safety checks and crisis resources always work, with or without the AI |
| Hosting going to sleep | Vercel doesn't sleep. The site loads instantly at any time |

---

## Part 1 — Create the database (Supabase)

### 1.1 Create the project
1. Go to https://supabase.com → **Start your project** → sign in with GitHub.
2. Click **New project**.
   - Name: `empathetic-ai`
   - Database password: click **Generate a password**. You don't need to save it for this app.
   - Region: **South Asia (Mumbai)**
   - Plan: **Free**
3. Click **Create new project** and wait about 2 minutes.

### 1.2 Create the tables
1. In the left sidebar, click **SQL Editor** → **New query**.
2. Open `supabase/setup.sql` in the GitHub repo and click the **Copy raw file** button (top right of the file view).
3. Paste it into the Supabase editor and click **Run**.
4. You should see "Success. No rows returned".
5. Check it worked: click **Table Editor** in the sidebar. You should see tables like `profiles`, `chat_sessions`, `messages`, `checkins`, `journal_entries` and `tasks`.

Run it only once. If you see "already exists", it already ran, so move on.

**Upgrading an older database?** Run `supabase/migrations/0004_trusted_contact_email.sql` and `0005_grants.sql` the same way. They add an email field for trusted contacts and give the app permission to read and write its tables (new Supabase projects no longer grant this automatically). Both are safe to run more than once.

### 1.3 Turn on sign-in options
Click **Authentication** in the sidebar.

1. **Sign In / Providers → Email**: keep it on, but switch **"Confirm email" OFF** and click **Save**.
   Why: Supabase's free email sender only sends 2 emails an hour, so visitors would never get their confirmation email.
2. On the same page, switch **"Allow anonymous sign-ins" ON** and click **Save**.
   This powers the **Continue as guest** button, so recruiters can try the app in one click.

You'll finish one more Supabase setting (URL Configuration) in Part 4, once you have your live URL.

### 1.4 Copy three values into your private note
1. Click the **Connect** button at the top of the project, or go to **Project Settings → Data API**. Copy the **Project URL** (looks like `https://abcd1234.supabase.co`). Label it `SUPABASE URL`.
2. Go to **Project Settings → API Keys**. If you see **Create new API keys**, click it.
   - Copy the **Publishable key** (starts with `sb_publishable_`). Label it `PUBLISHABLE KEY`.
   - Under **Secret keys**, click the eye or **Reveal**, then copy (starts with `sb_secret_`). Label it `SECRET KEY`. Never share this one.

If your project shows `anon` and `service_role` keys instead, those work too: anon = publishable, service_role = secret.

---

## Part 2 — Get the AI key (Groq)

1. Go to https://console.groq.com and sign in with Google or GitHub.
2. Click **API Keys** → **Create API Key**. Name it `empathetic-ai` → **Submit**.
3. Copy the key (starts with `gsk_`) into your note as `GROQ KEY`. It's shown only once.

The same key powers both chat replies and voice transcription.

**Optional, adds a second emotion model:** at https://huggingface.co sign up, then go to **Settings → Access Tokens → Create new token**. Choose type **Read** and copy it (starts with `hf_`) as `HF TOKEN`. You can skip this. The app works without it.

---

## Part 3 — Put the code on GitHub

1. Go to https://github.com/new
2. Repository name: `empathetic-ai`. Choose **Public**, so recruiters can see the code.
3. Leave every box unticked (no README, no .gitignore, no license) and click **Create repository**.
4. Push the project folder to it, either with `git push` or with **uploading an existing file** on the empty repo page (drag the folder contents in; GitHub accepts up to 100 files per upload, so upload in two batches if needed).

Refresh the repo page and you'll see `apps`, `docs`, `services`, `supabase` and `README.md`. A green check appears next to the latest commit a few minutes later, which means the automatic tests passed.

---

## Part 4 — Go live on Vercel (connects the real AI)

### 4.1 Import the project
1. Go to https://vercel.com/signup → **Continue with GitHub** → choose **Hobby** (free).
2. Click **Add New… → Project**.
3. Find `empathetic-ai` in the list and click **Import**. If it isn't listed, click **Adjust GitHub App Permissions**, allow access to `empathetic-ai`, and come back.

### 4.2 Configure (the important part)
1. **Project Name:** this becomes your URL. For example `empathetic-ai-yourname` gives `empathetic-ai-yourname.vercel.app`.
2. **Root Directory:** click **Edit** → select **apps/web** → **Continue**. ⚠️ If you skip this, the build fails.
3. Leave Framework (Next.js) and the build settings as they are.
4. Open **Environment Variables** and add these one at a time (Name in the left box, Value in the right, then **Add**):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your `SUPABASE URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your `PUBLISHABLE KEY` |
| `SUPABASE_SECRET_KEY` | your `SECRET KEY` |
| `GROQ_API_KEY` | your `GROQ KEY` |
| `HF_TOKEN` | your `HF TOKEN` (skip if you didn't make one) |

Everything else has sensible defaults, so you don't need to add more.

5. Click **Deploy**. Wait 1–2 minutes for the confetti, then click the preview image to open your live site. Copy the URL from the address bar.

### 4.3 Tell Supabase your live URL
1. Back in Supabase → **Authentication → URL Configuration**.
2. **Site URL:** paste your Vercel URL, for example `https://empathetic-ai-yourname.vercel.app` → **Save**.
3. **Redirect URLs** → **Add URL** → paste your URL followed by `/**`, for example `https://empathetic-ai-yourname.vercel.app/**` → **Save**.

That's it. You're live.

---

## Part 5 — Test it

Replies now come from Groq and respond to what you write. Run through this list on a laptop and a phone:

- [ ] Home page loads, and **Get help now** opens the help page without signing in
- [ ] **Try it as a guest** works and onboarding finishes
- [ ] A chat reply arrives **without** a "Demo mode" badge (this proves the Groq key works)
- [ ] Press the microphone, allow it, speak, **Stop**. Your words appear as editable text
- [ ] In **Problem Solver** mode, ask "Can you make me a plan?" → **Approve** → the tasks appear in Tasks
- [ ] **Settings → Add sample data** → **Insights** shows charts
- [ ] **Settings → Export JSON** downloads a file
- [ ] Safety route check: in a new test chat, type `I want to kill myself`. You should see a careful reply plus a "Talk to a person" panel with Tele-MANAS 14416 and 112. Then delete that chat (bin icon at the top)
- [ ] Open the site on your phone too
- [ ] Vercel → your project → **Settings** (bottom of the left sidebar, click its arrow) → **Cron Jobs**, or type "cron" in the Find box at the top left, lists `/api/v1/keepalive` (this is the daily keep-alive)

- [ ] During onboarding, the **Someone you trust** step saves a contact. Later, in a chat that triggers the help panel, that person appears with **Email**, **Text** and **Call** buttons, which open your own apps with a short draft

If something fails, see Troubleshooting below.

**Updating later.** Every push to `main` runs the tests on GitHub and redeploys the live site on Vercel in about a minute.

---

## Part 6 — Share it

**Nicer URL:** Vercel → your project → **Settings → Domains** to change the `.vercel.app` name or add your own domain. If you change it, add the new URL in Supabase **URL Configuration** too (Part 4.3).

**GitHub polish:** on the repo page, click the ⚙️ next to **About**. Add a one-line description and topics: `nextjs`, `supabase`, `llm`, `nlp`, `ai-safety`, `emotion-recognition`, and paste your live URL as the website. Then pin the repo on your GitHub profile.

**LinkedIn post (edit as you like):**

> I built Empathetic AI, a safety-first AI companion for everyday stress. You can type or talk, pick how you want support (just listening, thinking it through, or making a plan), and it turns overwhelm into small tasks you approve before anything is saved.
>
> Under the hood there's an emotion model I trained on GoEmotions and ported to TypeScript, fused with LLM signals and set to abstain when it isn't sure. An independent safety layer screens every message and every reply. Every table has Row Level Security, private chats are never stored, and you can export or delete your data in one click.
>
> Built with Next.js, Supabase, Groq and Vercel. It's a research prototype, not a clinical tool.
>
> Try it as a guest: [your URL]
> Code: https://github.com/your-username/empathetic-ai

Keep "research prototype, not a clinical tool" in anything public.

## Keeping it running

| Thing to know | What to do |
| --- | --- |
| The database keep-alive runs daily on its own | Nothing. To check, open Vercel → your project → Settings → Cron Jobs (or type "cron" in the Find box at the top left). If Supabase ever emails a pause warning, click **Resume project** in the Supabase dashboard. Data is kept. |
| Groq's free tier has daily limits per model | Nothing. The app switches models, and on a very busy day replies become simpler until the limits reset. |
| A key was shared by mistake | Make a new key (Groq: API Keys. Supabase: API Keys → new secret key), delete the old one, then update it in Vercel → Settings → Environment Variables → **Redeploy**. |
| Want a change later | Push to `main`. GitHub runs the tests and Vercel redeploys automatically. |

---

## Troubleshooting

| What you see | Fix |
| --- | --- |
| Vercel build fails: "No Next.js version detected" | Vercel → Settings → General → Root Directory = `apps/web` → Save → Deployments → ⋯ → **Redeploy** |
| Login page says "database isn't connected" | The two `NEXT_PUBLIC_SUPABASE_…` variables are missing or misspelled. Fix them in Vercel → Settings → Environment Variables → **Redeploy** |
| "Guest access isn't enabled yet" | Supabase → Authentication → Sign In / Providers → **Allow anonymous sign-ins** ON |
| Sign-up says "check your email" and nothing comes | Supabase → Authentication → Sign In / Providers → Email → **Confirm email** OFF |
| Onboarding says "We couldn't save that just now" or "database isn't fully set up" | The table permissions are missing. Run `supabase/migrations/0005_grants.sql` in the SQL Editor, then click **Finish** again |
| Errors mentioning `profiles` or "relation does not exist" | The SQL from Part 1.2 didn't run. Run it in the SQL Editor |
| Replies show "Demo mode" on the live site | `GROQ_API_KEY` is missing or wrong in Vercel. Fix it → **Redeploy** |
| Microphone says blocked | Click the lock icon next to the web address → allow Microphone. Typing always works |
| "You've reached the usage limit" | A per-person safety limit (40 messages an hour). Wait an hour |
| Delete account says "not configured" | `SUPABASE_SECRET_KEY` is missing in Vercel → add it → **Redeploy** |
| The site worked before but now shows errors after a week | The Supabase project paused. Click **Resume project** in Supabase |

> Any time you change an Environment Variable in Vercel, go to **Deployments → ⋯ (on the latest) → Redeploy** so the change takes effect.

## Environment variable reference

| Variable | Needed? | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable (or anon) key |
| `SUPABASE_SECRET_KEY` | Yes, for account deletion and the daily guest cleanup | Supabase secret (or service_role) key |
| `GROQ_API_KEY` | For real AI replies and voice | Without it, the app runs in demo mode |
| `HF_TOKEN` | Optional | Adds the DistilRoBERTa emotion model |
| `LLM_MODEL` / `LLM_FAST_MODEL` | Optional | Defaults `openai/gpt-oss-120b` / `openai/gpt-oss-20b`. Only change if Groq renames them |
| `LLM_FALLBACK_MODELS` | Optional | Backup models tried in order. Default `llama-3.3-70b-versatile,qwen/qwen3-32b,llama-3.1-8b-instant` |
| `RATE_LIMIT_PER_HOUR` / `RATE_LIMIT_PER_DAY` | Optional | Defaults 40 / 200 messages per person |

To run it locally, see the README.
