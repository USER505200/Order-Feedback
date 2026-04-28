require('dotenv').config();
const { REST, Routes } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

// حذف جميع الأوامر
rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] })
  .then(() => console.log('✅ تم حذف جميع الأوامر القديمة بنجاح!'))
  .catch(console.error);