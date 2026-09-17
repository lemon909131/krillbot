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
const REQUIRED_PREFIX = 'Krillion'; // adjust to match your actual required prefix

// Stores today's scores: userId -> { username, score }
let dailyScores = new Map();

client.on('messageCreate', async (message) => {
  if (message.channel.id !== CHANNEL_ID) return;
  if (message.author.bot) return;

  // Enforce the required prefix, same as before
  if (!message.content.startsWith(REQUIRED_PREFIX)) {
    await message.delete();
    const warning = await message.channel.send(
      `${message.author}, messages here must start with \`${REQUIRED_PREFIX}\`.`
    );
    setTimeout(() => warning.delete().catch(() => {}), 5000);
    return;
  }

  // Extract the score: first line that is purely a number
  const lines = message.content.split('\n').map((l) => l.trim());
  const scoreLine = lines.find((l) => /^\d+$/.test(l));

  if (scoreLine) {
    const score = parseInt(scoreLine, 10);
    dailyScores.set(message.author.id, {
      username: message.author.username,
      score,
    });
  }
});

// Runs every day at 10:00 PM Mountain Time (handles MST/MDT automatically)
cron.schedule(
  '0 22 * * *',
  async () => {
    if (dailyScores.size === 0) {
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
    }

    dailyScores.clear();
  },
  { timezone: 'America/Denver' }
);

client.login(process.env.BOT_TOKEN);