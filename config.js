module.exports = {
  // ─── STANDUP SCHEDULE ─────────────────────────────────────────────────────
  // Days of the week standups happen. 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Default: Monday–Friday
  standupDays: [1, 2, 3, 4, 5],

  // ─── VIDEO STANDUP DAYS ───────────────────────────────────────────────────
  // Days on which the video standup (camera-on call) happens.
  // The morning reminder will only fire on these days.
  // Default: every Monday (change to match your team's schedule)
  videoStandupDays: [3],

  // ─── MORNING REMINDER ─────────────────────────────────────────────────────
  // Channel that receives the "camera on!" morning message.
  // Update this to your real channel ID before going live.
  morningReminderChannelId: "C0139549ZSS",

  // Time (24-hour) to send the morning reminder on video standup days.
  morningReminderTime: { hour: 9, minute: 30 },

  // IANA timezone for the scheduler (e.g. 'America/New_York', 'Europe/London', 'Asia/Kolkata')
  timezone: "Asia/Kolkata",

  // ─── ADMINS ───────────────────────────────────────────────────────────────
  // Slack user IDs allowed to run /nocam. Find yours: click your profile → ⋮ → Copy member ID.
  // Example: ['U012AB3CD', 'U098ZY7WX']
  adminUserIds: ["U0988L3D8N4", "U09FA7ZGCBY", "U08FTCFKT8T"],

  // ─── SPIN EXPIRY ──────────────────────────────────────────────────────────
  // How many hours a spin link stays valid before it expires
  spinExpiryHours: 8,

  // ─── PUBLIC CHANNEL ANNOUNCEMENT ──────────────────────────────────────────
  // If set to a channel ID (e.g. "C012AB3CD"), the bot will post a fun
  // public announcement in that channel when someone completes their dare.
  // Set to null to keep it private (DM only).
  announcementChannelId: null,

  // ─── WHEEL COLORS ─────────────────────────────────────────────────────────
  // Full neon palette — one per segment. Will cycle if you have more dares.
  wheelColors: [
    "#FF073A",
    "#FF6B35",
    "#FFD700",
    "#39FF14",
    "#00FFFF",
    "#FF00FF",
    "#7B2FFF",
    "#FF1493",
    "#00FF87",
    "#FF4500",
    "#1AFFE4",
    "#FF6EC7",
    "#CCFF00",
    "#FF2D55",
    "#00BFFF",
    "#FF8C00",
    "#DA00FF",
    "#00FF41",
    "#FF3D00",
    "#1B81FF",
  ],
};
