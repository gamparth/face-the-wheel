# 🎡 Spin-Wheel Dare Bot — Setup Guide

A Slack bot that sends an animated spinning wheel GIF to anyone who doesn't turn their camera on during standup. They click SPIN, watch the wheel fly, and get their dare.

---

## Prerequisites

- Node.js 18 or higher
- A Slack workspace where you are an admin (or can install apps)
- macOS / Linux / Windows with WSL

---

## Step 1 — Install system dependencies for `canvas`

The wheel GIF is drawn with `node-canvas`, which needs a few native libraries.

**macOS**
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

**Ubuntu / Debian**
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev
```

**Windows** — use WSL2 with Ubuntu, then follow the Linux steps above.

---

## Step 2 — Create your Slack App

1. Go to **https://api.slack.com/apps** and click **Create New App → From scratch**.
2. Name it something fun: `Dare Wheel Bot`
3. Pick your workspace.

---

## Step 3 — Enable Socket Mode

Socket Mode means the bot connects outbound — no public URL or ngrok needed.

1. In the left sidebar go to **Settings → Socket Mode**.
2. Toggle **Enable Socket Mode** → ON.
3. When prompted, create an App-Level Token:
   - Name: `socket-token`
   - Scope: `connections:write`
4. Copy the token — it starts with `xapp-`. Save it as **SLACK_APP_TOKEN**.

---

## Step 4 — Add Bot Scopes

1. Go to **Features → OAuth & Permissions**.
2. Scroll to **Bot Token Scopes** and add:
   - `chat:write` — send messages
   - `im:write` — send DMs
   - `files:write` — upload the GIF
   - `commands` — respond to slash commands
   - `users:read` — look up user info (optional, for nicer error messages)

---

## Step 5 — Create slash commands

1. Go to **Features → Slash Commands → Create New Command**.
2. Fill in the command:
   - **Command:** `/nocam`
   - **Short description:** `Send the dare wheel to camera-off offenders (admin only)`
   - **Usage hint:** `@user1 @user2 … | list | triggermessage`
3. Save.

---

## Step 6 — Enable DMs (App Home)

1. Go to **Features → App Home**.
2. Under **Show Tabs**, enable **Messages Tab**.
3. Check **Allow users to send Slash commands and messages from the messages tab**.

---

## Step 7 — Install the app to your workspace

1. Go to **Settings → Install App**.
2. Click **Install to Workspace** and approve.
3. Copy the **Bot User OAuth Token** — it starts with `xoxb-`. Save as **SLACK_BOT_TOKEN**.
4. Go to **Settings → Basic Information → App Credentials** and copy the **Signing Secret**. Save as **SLACK_SIGNING_SECRET**.

---

## Step 8 — Configure the project

```bash
# Clone / unzip the project folder, then:
cd spin-wheel-dare-bot
npm install

# Copy the env template
cp .env.example .env
```

Open `.env` and paste in your three tokens:
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
```

---

## Step 9 — Customise (optional)

Open **`config.js`** to tweak:

| Setting | What it does |
|---|---|
| `standupDays` | Weekdays the bot is active (0=Sun, 1=Mon, ..., 6=Sat) |
| `videoStandupDays` | Days on which the camera-on reminder fires (e.g. `[3]` for Wed) |
| `morningReminderChannelId` | Slack Channel ID for the morning notification |
| `morningReminderTime` | Time to send reminder (e.g. `{ hour: 9, minute: 30 }`) |
| `timezone` | IANA timezone for the scheduler (e.g. `Asia/Kolkata`) |
| `adminUserIds` | List of Slack member IDs allowed to run admin commands |
| `spinExpiryHours` | How long the spin button stays valid |
| `announcementChannelId` | Post a public "X got dare #Y!" in a channel (or `null`) |
| `wheelColors` | Change the wheel's segment colours |

Open **`dares.js`** to add, remove, or rewrite any dare. The wheel auto-resizes.

---

## Step 10 — Pre-generate the wheel GIFs

Before running the bot, you must generate the wheel animations for each dare.

```bash
node generate-gifs.js
```

This will create a folder `./gifs/` with one GIF for every dare in `dares.js`. If you add new dares later, run this command again.

---

## Step 11 — Run it!

```bash
node app.js
```

You should see:
```
🎡 Spin-Wheel Dare Bot is running!
   Standup days:  Mon, Tue, Wed, Thu, Fri
   Dares loaded:  12
   GIFs cached:   12/12
   Morning reminder: 9:30 on Wed (Asia/Kolkata) → #C0139549ZSS
```
Alternatively, use the **manual reminder** command once you are in Slack.

---

## Daily usage

During or right after standup, the admin types in any Slack channel:

**1. Send dare wheels to offenders**
```
/nocam @alice @bob
```
Each person gets a private DM with a big SPIN button. They click it, watch the animated wheel spin, and their dare appears.

**2. List who hasn't spun yet today**
```
/nocam list
```

**3. Manually fire the morning reminder**
```
/nocam triggermessage
```
Useful if the bot was offline during the scheduled time or you want to nudge the team early.

---

## Running in production

For a production setup you'll want to:
- Run with **pm2**: `pm2 start app.js --name dare-wheel`
- Replace the in-memory `pendingSpins` Map in `app.js` with Redis or SQLite so spins survive restarts
- Host on any cheap VPS (the bot uses outbound Socket Mode so no inbound firewall rules needed)

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails on `canvas` | Re-check Step 1 — system libs must be installed first |
| Bot doesn't respond to `/nocam` | Make sure the app is installed and Socket Mode is on |
| Can't DM a user | They may have DMs from apps disabled — ask them to enable in Slack preferences |
| GIF upload fails | Double-check `files:write` scope is added and app is reinstalled after adding it |

---

Built with [@slack/bolt](https://slack.dev/bolt-js/), [node-canvas](https://github.com/Automattic/node-canvas), and [gif-encoder-2](https://www.npmjs.com/package/gif-encoder-2).
