import { Client, GatewayIntentBits, SlashCommandBuilder, Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import 'dotenv/config';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: ['CHANNEL'], // Needed to DM users
});

const FEEDBACK_CHANNEL_ID = '1462019751218778112';
const PREFIX = 'S!';

// Register slash command globally
const commands = [
    new SlashCommandBuilder()
        .setName('feedback')
        .setDescription('Send feedback to the devs')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('Your feedback')
                .setRequired(true)
        )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.SONUS_TOKEN);

(async () => {
    try {
        console.log('Registering slash commands globally...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Slash commands registered.');
    } catch (error) {
        console.error(error);
    }
})();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Handle prefix commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'feedback') {
        const feedback = args.join(' ');
        if (!feedback) return message.reply('Please provide feedback text.');

        const channel = await client.channels.fetch(FEEDBACK_CHANNEL_ID).catch(() => null);
        if (!channel?.isTextBased()) return message.reply('Feedback channel not found.');

        try {
            await channel.send(`[${message.author.tag}] ID:${message.author.id} says \`${feedback}\``);
            await message.author.send('Your feedback was sent');
        } catch (err) {
            console.error(err);
            await message.author.send('Feedback could not be sent, the devs have been notified');
            if (channel) await channel.send(`[${message.author.tag}] could not send feedback`);
        }
    }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'feedback') {
        const feedback = interaction.options.getString('text');
        const channel = await client.channels.fetch(FEEDBACK_CHANNEL_ID).catch(() => null);

        if (!channel?.isTextBased()) {
            return interaction.reply({ content: 'Feedback channel not found.', ephemeral: true });
        }

        try {
            await channel.send(`[${interaction.user.tag}] ID:${interaction.user.id} says \`${feedback}\``);
            await interaction.user.send('Your feedback was sent');
            await interaction.reply({ content: 'Feedback sent successfully!', ephemeral: true });
        } catch (err) {
            console.error(err);
            await interaction.user.send('Feedback could not be sent, the devs have been notified');
            if (channel) await channel.send(`[${interaction.user.tag}] could not send feedback`);
            await interaction.reply({ content: 'There was an error sending your feedback.', ephemeral: true });
        }
    }
});

client.login(process.env.SONUS_TOKEN);
