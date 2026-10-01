const { Client, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const CHANNEL_ID = '1549684077421010996';
const REQUIRED_PREFIX = 'Krillion';

// Today's scores: userId -> { username, score }  (used for the daily winner)
let dailyScores = new Map();

// This week's running totals: userId -> { username, total }  (used for the weekly leaderboard)
let weeklyScores = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.channel.id !== CHANNEL_ID) return;
  if (message.author.bot) return;

  if (!message.content.startsWith(REQUIRED_PREFIX)) {
    await message.delete();
    const warning = await message.channel.send(
      `${message.author}, messages here must start with \`${REQUIRED_PREFIX}\`.`
    );
    setTimeout(() => warning.delete().catch(() => {}), 5000);
    return;
  }

  const lines = message.content.split('\n').map((l) => l.trim());
  const scoreLine = lines.find((l) => /^\d+$/.test(l));

  if (scoreLine) {
    const score = parseInt(scoreLine, 10);

    // Update today's score (overwrite, for the daily winner)
    dailyScores.set(message.author.id, {
      username: message.author.username,
      score,
    });

    // Add to this week's running total (sum, for the weekly leaderboard)
    const existing = weeklyScores.get(message.author.id);
    if (existing) {
      existing.total += score;
    } else {
      weeklyScores.set(message.author.id, {
        username: message.author.username,
        total: score,
      });
    }

    console.log(`Recorded score for ${message.author.username}: ${score}`);
  }
});

// Daily winner — every day at 10:00 PM Mountain Time
cron.schedule(
  '0 22 * * *',
  async () => {
    console.log('Daily cron triggered at', new Date().toString());
    console.log('Current dailyScores:', dailyScores);

    if (dailyScores.size === 0) {
      console.log('No scores today, skipping announcement.');
      dailyScores.clear();
      return;
    }

    let topUserId = null;
    let topScore = -Infinity;

    for (const [userId, data] of dailyScores.entries()) {
      if (data.score > topScore) {
        topScore = data.score;
        topUserId = userId;
      }
    }

    if (topUserId) {
      const channel = await client.channels.fetch(CHANNEL_ID);
      await channel.send(`🏆 Today's top score goes to <@${topUserId}> with **${topScore}**!`);
      console.log(`Announced daily winner: ${topUserId} with ${topScore}`);
    }

    dailyScores.clear();
  },
  { timezone: 'America/Denver' }
);

// Weekly leaderboard — every Friday at 10:00 PM Mountain Time
cron.schedule(
  '0 22 * * 5',
  async () => {
    console.log('Weekly cron triggered at', new Date().toString());
    console.log('Current weeklyScores:', weeklyScores);

    if (weeklyScores.size === 0) {
      console.log('No scores this week, skipping weekly leaderboard.');
      weeklyScores.clear();
      return;
    }

    // Sort everyone by total, highest first
    const ranked = [...weeklyScores.entries()].sort((a, b) => b[1].total - a[1].total);

    const medals = ['🥇', '🥈', '🥉'];
    const lines = ranked.map(([userId, data], index) => {
      const medal = medals[index] || `${index + 1}.`;
      return `${medal} <@${userId}> — **${data.total}**`;
    });

    const channel = await client.channels.fetch(CHANNEL_ID);
    await channel.send(`📊 **Weekly Leaderboard**\n${lines.join('\n')}`);
    console.log('Posted weekly leaderboard.');

    weeklyScores.clear();
  },
  { timezone: 'America/Denver' }
);

client.login(process.env.BOT_TOKEN);