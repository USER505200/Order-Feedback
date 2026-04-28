require('dotenv').config();
const { REST, Routes } = require('discord.js');
const completeOrder = require('./commands/completeOrder');

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;

  if (!token || !clientId || !guildId) {
    throw new Error('Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env');
  }

  const rest = new REST({ version: '10' }).setToken(token);

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: [completeOrder.data.toJSON()],
  });

  console.log('Registered /complete-order successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
