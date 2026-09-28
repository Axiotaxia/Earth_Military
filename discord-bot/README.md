# Earth Military Discord Bot

A thin Discord messenger for the Host Events system. All event logic and
state lives on the website (Supabase); this bot only posts/edits/deletes
Discord messages and reports reactions/button clicks back.

## What it needs to run

- A Discord bot application + token (Discord Developer Portal)
- The bot invited to both servers (Main and Military) with these permissions:
  - View Channels, Send Messages, Manage Messages (to delete poll/co-host
    messages later), Add Reactions, Read Message History
- **Privileged Gateway Intents** enabled on the bot (Developer Portal -> your
  app -> Bot -> Privileged Gateway Intents): turn on **Server Members Intent**
  and **Message Content Intent**. Without Server Members Intent, member
  search and role checks will fail.
- A Supabase service role key (Project Settings -> API -> service_role)
- A place to run it 24/7 (Railway recommended)

## Environment variables

Copy `.env.example` to `.env` locally for testing, or set these directly in
Railway's dashboard for deployment. See `.env.example` for the full list and
what each one is for.

## Deploying on Railway

1. Push this repo to GitHub (the whole Earth_Military repo, or just this
   `discord-bot` folder as its own repo - either works).
2. On https://railway.app, create a New Project -> Deploy from GitHub repo.
3. If deploying the whole monorepo, set the **Root Directory** to
   `discord-bot` in Railway's service settings, so it only builds this
   folder.
4. In Railway's Variables tab, add every variable from `.env.example` with
   real values.
5. Railway auto-detects `npm start` from `package.json` - no extra build
   config needed.
6. Once deployed, Railway gives you a public URL
   (e.g. `https://your-bot.up.railway.app`). That's your `BOT_API_URL`.

## Wiring the website to the bot

In your Supabase project, go to Edge Functions -> Manage secrets, and add:

- `BOT_API_URL` = the Railway URL from step 6 above
- `BOT_API_SECRET` = the same value you set as `BOT_API_SECRET` on Railway
- `SESSION_SECRET` = a NEW long random string (e.g. `openssl rand -hex 32`).
  Used to sign and verify login session tokens. Keep it different from
  `BOT_API_SECRET`, and never share it.

Then **deploy these two edge functions** (a git push alone does not deploy them):

- `host-events` (new - the only function the Host Events page talks to)
- `roblox-oauth` (updated - it now issues the signed session token at login)

Anyone who wants to host must sign out and back in once so they receive a token.

## Bloxlink (verifying a host's Discord account)

Bloxlink's API needs a key: get one from the Bloxlink developer dashboard and
set it as `BLOXLINK_API_KEY` on Railway. When a host picks their Discord
account, the bot asks Bloxlink whether it is linked to that host's Roblox
account and refuses if not, so nobody can claim someone else's Discord identity.

## Security notes

- Never commit `.env` or paste your bot token anywhere public (chat, GitHub,
  Discord). If it's ever exposed, reset it immediately in the Developer
  Portal.
- `BOT_API_SECRET` should be a long random string (e.g. `openssl rand -hex
  32`), not something guessable. It's the only thing standing between "any
  request" and "your bot posts things in your servers".
