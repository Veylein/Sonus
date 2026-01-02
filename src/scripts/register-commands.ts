import 'dotenv/config';
import { REST } from 'discord.js';
import fs from 'fs';
import path from 'path';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
if (!token || !clientId || !guildId) {
  console.error('DISCORD_TOKEN, CLIENT_ID, and GUILD_ID must be set in .env');
  process.exit(1);
}

const commands: any[] = [];
const commandsPath = path.join(__dirname, '..', 'commands');
const commandFiles = fs.existsSync(commandsPath)
  ? fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'))
  : [];

for (const file of commandFiles) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const command = require(path.join(commandsPath, file));
  const cmd = command.default ?? command;
  if (cmd && cmd.data) commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);
(async () => {
  try {
    console.log(`Registering ${commands.length} commands to guild ${guildId}`);
    await rest.put(`/applications/${clientId}/guilds/${guildId}/commands`, { body: commands });
    console.log('Commands registered.');
  } catch (err) {
    console.error('Failed to register commands', err);
  }
})();
