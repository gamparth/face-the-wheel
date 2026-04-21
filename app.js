/**
 * app.js — Spin-Wheel Dare Bot for Slack
 *
 * Commands
 * ────────
 *  /standup-morning             Manually fire the morning camera-on reminder
 *  /nocam @user1 @user2 …       Send dare wheels to camera-off offenders (admins only)
 *  /nocam list                  Show today's pending spins
 *
 * Flow
 * ────
 *  1. Bot sends morning reminder to the configured channel on video standup days
 *  2. Admin runs /nocam with mentions
 *  3. Bot DMs each offender with a "SPIN THE WHEEL" button
 *  4. User clicks → pre-generated GIF from ./gifs/ is posted to the DM
 *  5. Dare text shown as the GIF comment; admin receives a summary DM
 *
 * NOTE: Run `node generate-gifs.js` once before starting this bot.
 */

require("dotenv").config();
const { App } = require("@slack/bolt");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { dares } = require("./dares");
const config = require("./config");

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// ─── GIF cache ────────────────────────────────────────────────────────────────
// Loaded once at startup so spin_wheel never blocks the event loop on disk I/O.
const gifCache = new Map();

function loadGifs() {
  for (let i = 0; i < dares.length; i++) {
    try {
      gifCache.set(
        i,
        fs.readFileSync(path.join(__dirname, "gifs", `spin-${i}.gif`)),
      );
    } catch {
      // Missing GIFs fall back to text-only dare at spin-time
    }
  }
}

// ─── Spin store ───────────────────────────────────────────────────────────────
const pendingSpins = new Map();

function createSpinId(userId) {
  return `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isExpired(spin) {
  return Date.now() > spin.expiresAt;
}

function cleanupExpired() {
  for (const [id, spin] of pendingSpins) {
    if (isExpired(spin)) pendingSpins.delete(id);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isStandupDay() {
  return config.standupDays.includes(new Date().getDay());
}

function mrkdwnBlock(text) {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function formatDareMessage(dareIndex, username) {
  return [
    `Hey <@${username}>! :wave: Looks like your camera stayed off today, so Face the Wheel Lottery has spoken. :ferris_wheel:`,
    "",
    `Your dare for next standup: *${dares[dareIndex]}*`,
    "",
    `Next call, we'll be watching. Good luck! :smile:`,
  ].join("\n");
}

const MORNING_REMINDER_TEXT =
  "<!channel> :ferris_wheel: Good morning, team! It's camera time — once a week keeps the team spirit alive. " +
  "Turn on your camera today and show us that face. Today's face the wheel spin is live. " +
  "Anyone who skips the camera gets a dare. You've been warned. :smile:";

async function sendMorningReminder(client) {
  await client.chat.postMessage({
    channel: config.morningReminderChannelId,
    text: MORNING_REMINDER_TEXT,
  });
}

function buildSpinMessage(spinId, userId) {
  return {
    blocks: [
      mrkdwnBlock(
        [
          `Uh oh <@${userId}>, camera off! The wheel has been waiting for you. :ferris_wheel:`,
          `Spin it to reveal your dare. Whatever it lands on, the team will be watching at the next standup. :eyes:`,
        ].join("\n"),
      ),
      { type: "divider" },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🎡  SPIN THE WHEEL!",
              emoji: true,
            },
            action_id: "spin_wheel",
            value: spinId,
          },
        ],
      },
    ],
  };
}

// ─── /nocam command ───────────────────────────────────────────────────────────
app.command("/nocam", async ({ command, ack, client, respond }) => {
  await ack();

  if (
    config.adminUserIds.length > 0 &&
    !config.adminUserIds.includes(command.user_id)
  ) {
    await respond({
      text: "🚫 Only admins can use this command.",
      response_type: "ephemeral",
    });
    return;
  }

  const text = (command.text || "").trim();

  if (text === "triggermessage") {
    try {
      await sendMorningReminder(client);
      await respond({
        text: `✅ Morning reminder sent to <#${config.morningReminderChannelId}>.`,
        response_type: "ephemeral",
      });
    } catch (err) {
      await respond({
        text: `❌ Failed to send reminder: ${err.message}`,
        response_type: "ephemeral",
      });
    }
    return;
  }

  if (text === "list") {
    cleanupExpired();
    const active = [...pendingSpins.values()].filter(
      (s) => !s.used && !isExpired(s),
    );
    if (active.length === 0) {
      await respond({
        text: "✅ No pending spins right now.",
        response_type: "ephemeral",
      });
    } else {
      const lines = active.map(
        (s) => `• <@${s.userId}> — dare #${s.dareIndex + 1}`,
      );
      await respond({
        text: `*Pending spins (${active.length}):*\n${lines.join("\n")}`,
        response_type: "ephemeral",
      });
    }
    return;
  }

  if (!isStandupDay()) {
    await respond({
      text: "⚠️ Today isn't a standup day — no dare wheels sent.",
      response_type: "ephemeral",
    });
    return;
  }

  const userIds = [...text.matchAll(/<@([A-Z0-9]+)(?:\|[^>]+)?>/g)].map(
    (m) => m[1],
  );

  if (userIds.length === 0) {
    await respond({
      text: "⚠️ No users mentioned!\nUsage: `/nocam @alice @bob`\nList pending: `/nocam list`\nTrigger morning message: `/nocam triggermessage`",
      response_type: "ephemeral",
    });
    return;
  }

  const expiresAt = Date.now() + config.spinExpiryHours * 60 * 60 * 1000;

  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      const dareIndex = Math.floor(Math.random() * dares.length);
      const spinId = createSpinId(userId);
      pendingSpins.set(spinId, { userId, dareIndex, expiresAt, used: false });
      try {
        await client.chat.postMessage({
          channel: userId,
          ...buildSpinMessage(spinId, userId),
        });
      } catch (err) {
        pendingSpins.delete(spinId);
        throw err;
      }
      return { userId, dareIndex };
    }),
  );

  const sent = [],
    failed = [],
    dareAssignments = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      sent.push(result.value.userId);
      dareAssignments.push(result.value);
    } else {
      console.error(`Failed to DM ${userIds[i]}:`, result.reason.message);
      failed.push(userIds[i]);
    }
  });

  const lines = [];
  if (sent.length)
    lines.push(
      `✅ Dare wheel sent to: ${sent.map((u) => `<@${u}>`).join(", ")}`,
    );
  if (failed.length)
    lines.push(
      `❌ Could not DM: ${failed.map((u) => `<@${u}>`).join(", ")} (check they allow DMs from apps)`,
    );
  await respond({ text: lines.join("\n"), response_type: "ephemeral" });

  if (dareAssignments.length > 0) {
    const summaryLines = [
      "📋 *Dare Assignment Summary*",
      `_${new Date().toDateString()} — sent by you_`,
      "",
      ...dareAssignments.map(
        ({ userId, dareIndex }) => `• <@${userId}> → *${dares[dareIndex]}*`,
      ),
    ];
    try {
      await client.chat.postMessage({
        channel: command.user_id,
        text: summaryLines.join("\n"),
      });
    } catch (err) {
      console.error("Failed to send dare summary to admin:", err.message);
    }
  }
});

// ─── Spin button interaction ───────────────────────────────────────────────────
app.action("spin_wheel", async ({ ack, body, client, action }) => {
  await ack();

  const spinId = action.value;
  const spin = pendingSpins.get(spinId);
  const channelId = body.channel.id;
  const messageTs = body.message.ts;
  const userId = body.user.id;

  if (!spin || spin.used) {
    await client.chat.update({
      channel: channelId,
      ts: messageTs,
      text: "⚠️ You already spun! One dare per standup session.",
      blocks: [
        mrkdwnBlock(
          "⚠️ *You already spun the wheel!*\nOne dare per standup session — no do-overs. 😄",
        ),
      ],
    });
    return;
  }

  if (isExpired(spin)) {
    pendingSpins.delete(spinId);
    await client.chat.update({
      channel: channelId,
      ts: messageTs,
      text: "⏰ This spin link has expired.",
      blocks: [
        mrkdwnBlock(
          `⏰ *This spin has expired!*\nAsk an admin to resend it with \`/nocam <@${userId}>\`.`,
        ),
      ],
    });
    return;
  }

  if (userId !== spin.userId) {
    await client.chat.update({
      channel: channelId,
      ts: messageTs,
      text: "🚫 This spin belongs to someone else.",
      blocks: [mrkdwnBlock("🚫 *This spin belongs to someone else.*")],
    });
    return;
  }

  // Mark used and evict before any await — prevents double-spin on rapid re-clicks
  spin.used = true;
  pendingSpins.delete(spinId);

  await client.chat.update({
    channel: channelId,
    ts: messageTs,
    text: "🎡 Spinning the wheel…",
    blocks: [mrkdwnBlock("🎡 *Spinning the wheel…*")],
  });

  const dareText = formatDareMessage(spin.dareIndex, userId);
  const gifBuffer = gifCache.get(spin.dareIndex);

  if (!gifBuffer) {
    console.error(
      `GIF missing for index ${spin.dareIndex} — run: node generate-gifs.js`,
    );
    await client.chat.update({
      channel: channelId,
      ts: messageTs,
      text: dareText,
      blocks: [
        mrkdwnBlock(
          `⚠️ GIFs not ready. Ask an admin to run \`node generate-gifs.js\`.\n\n${dareText}`,
        ),
      ],
    });
    await announceIfConfigured(client, userId, spin.dareIndex);
    return;
  }

  try {
    await client.files.uploadV2({
      channel_id: channelId,
      file: gifBuffer,
      filename: "dare-wheel.gif",
      initial_comment: dareText,
    });
    await client.chat.delete({ channel: channelId, ts: messageTs });
  } catch (err) {
    console.error("File upload failed:", err.message);
    await client.chat.update({
      channel: channelId,
      ts: messageTs,
      text: dareText,
      blocks: [mrkdwnBlock(dareText)],
    });
  }

  await announceIfConfigured(client, userId, spin.dareIndex);
});

// ─── Optional public channel announcement ─────────────────────────────────────
async function announceIfConfigured(client, userId, dareIndex) {
  if (!config.announcementChannelId) return;
  try {
    await client.chat.postMessage({
      channel: config.announcementChannelId,
      text: `🎡 <@${userId}> just spun the Dare Wheel and got *Dare #${dareIndex + 1}*! 🔥 Will they follow through? 👀`,
    });
  } catch (err) {
    console.error("Announcement failed:", err.message);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
(async () => {
  loadGifs();
  await app.start();

  console.log("🎡 Spin-Wheel Dare Bot is running!");
  console.log(
    `   Standup days:  ${config.standupDays.map((d) => DAY_NAMES[d]).join(", ")}`,
  );
  console.log(`   Dares loaded:  ${dares.length}`);
  console.log(`   GIFs cached:   ${gifCache.size}/${dares.length}`);

  const { hour, minute } = config.morningReminderTime;
  const dayNames = config.videoStandupDays.map((d) => DAY_NAMES[d]).join(", ");

  cron.schedule(
    `${minute} ${hour} * * ${config.videoStandupDays.join(",")}`,
    async () => {
      try {
        await sendMorningReminder(app.client);
        console.log("📢 Morning reminder sent.");
      } catch (err) {
        console.error("Morning reminder failed:", err.message);
      }
    },
    { timezone: config.timezone },
  );

  // Purge expired spin entries once at midnight on the day after each video standup day
  const cleanupDays = config.videoStandupDays.map((d) => (d + 1) % 7).join(",");
  cron.schedule(`0 0 * * ${cleanupDays}`, cleanupExpired, {
    timezone: config.timezone,
  });

  console.log(
    `   Morning reminder: ${hour}:${String(minute).padStart(2, "0")} on ${dayNames} (${config.timezone}) → #${config.morningReminderChannelId}`,
  );
})();
