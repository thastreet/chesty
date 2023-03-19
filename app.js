const { Client, GatewayIntentBits } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { createAudioPlayer } = require("@discordjs/voice");
const { token, client_id, guild_id } = require("./config.json");
const { listenForInteraction, CommandNames } = require("./player.js");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildVoiceStates
	]
});

const commands = [
	new SlashCommandBuilder()
		.setName(CommandNames.Play)
		.setDescription("Play your favourite song")
		.addStringOption(option =>
			option.setName("query")
				.setDescription("Could be the Youtube url, Spotify share link or a text query")
				.setRequired(true)
		),
	new SlashCommandBuilder()
		.setName(CommandNames.Skip)
		.setDescription("Skip the current song"),
	new SlashCommandBuilder()
		.setName(CommandNames.Clear)
		.setDescription("Clear the queue")
].map(command => command.toJSON());

const rest = new REST().setToken(token);

(async () => {
	try {
		await rest.put(
			Routes.applicationGuildCommands(client_id, guild_id),
			{ body: commands }
		);
	} catch (error) {
		console.error(error);
	}
})();

client.once("ready", () => {
	console.log("Ready!");
});

listenForInteraction(client, [], createAudioPlayer());

client.login(token);