const { Client, GatewayIntentBits } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { createAudioResource, createAudioPlayer, joinVoiceChannel, StreamType, AudioPlayerStatus, AudioPlayer } = require("@discordjs/voice");
const { token, youtube_api_key, client_id, guild_id } = require("./config.json");
const ytdl = require("ytdl-core");
const axios = require("axios");
const { getSpotifyMetadata } = require("./spotify/spotify.js");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildVoiceStates
	]
});

const commandNames = {
	play: "play",
	skip: "skip",
	clear: "clear"
};

const commands = [
	new SlashCommandBuilder()
		.setName(commandNames.play)
		.setDescription("Play your favourite song")
		.addStringOption(option =>
			option.setName("query")
				.setDescription("Could be the Youtube url, Spotify share link or a text query")
				.setRequired(true)
		),
	new SlashCommandBuilder()
		.setName(commandNames.skip)
		.setDescription("Skip the current song"),
	new SlashCommandBuilder()
		.setName(commandNames.clear)
		.setDescription("Clear the queue")
].map(command => command.toJSON());

const rest = new REST().setToken(token);

(async () => {
	try {
		const data = await rest.put(
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

onInteraction([], createAudioPlayer());

function onInteraction(queue, player) {
	client.once("interactionCreate", async interaction => {
		if (interaction.commandName === commandNames.play) {
			const query = interaction.options.getString("query");
			resolveQuery(queue, interaction, query, player);
		} else if (interaction.commandName === commandNames.skip) {
			interaction.reply("Skipping!");
			player.stop();
		} else if (interaction.commandName === commandNames.clear) {
			clear(queue, interaction);
		}

		onInteraction(queue, player);
	});
}

function resolveQuery(queue, interaction, query, player) {
	if (query.includes("open.spotify.com")) {
		getSpotifyMetadata(query, (trackName, artist) => {
			const query = `${artist} ${trackName} audio`;
			searchYoutube(queue, query, interaction, player);
		});
	} else if (query.includes("youtube.com")) {
		playUrl(queue, query, interaction, player);
	} else {
		searchYoutube(`${query} audio`, interaction, player);
	}
}

function searchYoutube(queue, query, interaction, player) {
	axios
		.get(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${encodeURIComponent(query)}&key=${youtube_api_key}`)
		.then(res => {
			const youtubeVideoId = res.data.items[0].id.videoId;
			playUrl(queue, `https://www.youtube.com/watch?v=${youtubeVideoId}`, interaction, player);
		})
		.catch(error => {
			console.error(error);
		});
}

function playUrl(queue, url, interaction, player) {
	ytdl.getInfo(url).then((songInfo) => {
		const song = {
			title: songInfo.videoDetails.title,
			url: songInfo.videoDetails.video_url,
		};

		if (player.state.status == AudioPlayerStatus.Idle) {
			try {
				const voiceChannel = interaction.member.voice.channel;

				const connection = joinVoiceChannel({
					channelId: voiceChannel.id,
					guildId: guild_id,
					adapterCreator: voiceChannel.guild.voiceAdapterCreator
				});

				const playNextSong = () => {
					if (queue.length > 0) {
						play(null, queue.shift(), connection, player, playNextSong);
						console.log(queue);
					}
				};

				play(interaction, song, connection, player, playNextSong);
			} catch (err) {
				console.log(err);
				interaction.reply(err);
			}
		} else {
			queue.push(song);
			console.log(queue);
			interaction.reply(`${song.title} has been added to the queue!`);
		}
	});
}

function clear(queue, interaction) {
	if (queue.length == 0) return;
	queue = [];
	console.log(queue);
	interaction.reply("The queue has been cleared!");
}

function play(interaction, song, connection, player, playNextSong) {
	if (interaction) {
		interaction.reply(`Yezzir playing: ${song.url}`);
	}

	const stream = ytdl(song.url, {
		quality: "highestaudio",
		highWaterMark: 1 << 25
	});
	player.play(createAudioResource(stream, { inputType: StreamType.Arbitrary }));
	player.on(AudioPlayerStatus.Idle, playNextSong);
	connection.subscribe(player);
}

client.login(token);