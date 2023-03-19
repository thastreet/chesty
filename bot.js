const { Client, GatewayIntentBits } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { createAudioResource, createAudioPlayer, joinVoiceChannel, StreamType, AudioPlayerStatus } = require('@discordjs/voice');
const { token, spotify_client_id, spotify_client_secret, youtube_api_key, client_id, guild_id } = require('./config.json');
const ytdl = require('ytdl-core');
const axios = require('axios');

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildVoiceStates
	]
});

const commands = [
	new SlashCommandBuilder()
		.setName('play')
		.setDescription('Play your favourite song')
		.addStringOption(option =>
			option.setName('query')
				.setDescription('Could be the Youtube url, Spotify share link or a text query')
				.setRequired(true)
		),
	new SlashCommandBuilder()
		.setName('skip')
		.setDescription('Skip the current song'),
	new SlashCommandBuilder()
		.setName('clear')
		.setDescription('Clear the queue')
].map(command => command.toJSON());

const rest = new REST().setToken(token);

(async () => {
	try {
		const data = await rest.put(
			Routes.applicationGuildCommands(client_id, guild_id),
			{ body: commands },
		);
	} catch (error) {
		console.error(error);
	}
})();

client.once('ready', () => {
	console.log('Ready!');
});

client.once('reconnecting', () => {
	console.log('Reconnecting!');
});

client.once('disconnect', () => {
	console.log('Disconnect!');
});

onInteraction([], null);

function onInteraction(queue, playingSong) {
	client.once('interactionCreate', async interaction => {
		if (interaction.commandName === 'play') {
			const query = interaction.options.getString('query')
			execute(queue, playingSong, interaction, query);
		} else if (interaction.commandName === 'skip') {
			skip(playingSong, interaction);
		} else if (interaction.commandName === 'clear') {
			clear(queue, interaction);
		}

		onInteraction(queue)
	});
}

function execute(queue, playingSong, interaction, query) {
	if (query.includes("open.spotify.com")) {
		searchSpotify(queue, playingSong, query, interaction);
	} else if (query.includes("youtube.com")) {
		playUrl(queue, playingSong, query, interaction);
	} else {
		searchYoutube(query + " audio", interaction);
	}
}

function searchSpotify(queue, playingSong, url, interaction) {
	const config = {
		headers: {
			"Authorization": "Basic " + Buffer.from(spotify_client_id + ":" + spotify_client_secret).toString('base64')
		}
	}

	const params = new URLSearchParams();
	params.append('grant_type', 'client_credentials');

	axios
		.post('https://accounts.spotify.com/api/token', params, config)
		.then(res => {
			const accessToken = res.data.access_token;

			const lastIndexOfSlash = url.lastIndexOf("/");
			const indexOfParams = url.lastIndexOf("?");
			const endIndex = indexOfParams != -1 ? indexOfParams : url.length
			const trackId = url.substring(lastIndexOfSlash + 1, endIndex);

			axios
				.get("https://api.spotify.com/v1/tracks/" + trackId, { headers: { "Authorization": "Bearer " + accessToken } })
				.then(res => {
					const trackName = res.data.name;
					const artist = res.data.artists[0].name;
					const query = artist + " " + trackName + " audio";
					searchYoutube(queue, playingSong, query, interaction);
				})
				.catch(error => {
					console.error(error);
				})

		})
		.catch(error => {
			console.error(error)
		})
}

function searchYoutube(queue, playingSong, query, interaction) {
	axios
		.get("https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=" + encodeURIComponent(query) + "&key=" + youtube_api_key)
		.then(res => {
			const youtubeVideoId = res.data.items[0].id.videoId;
			playUrl(queue, playingSong, "https://www.youtube.com/watch?v=" + youtubeVideoId, interaction);
		})
		.catch(error => {
			console.error(error)
		})
}

function playUrl(queue, playingSong, url, interaction) {
	ytdl.getInfo(url).then((songInfo) => {
		const song = {
			title: songInfo.videoDetails.title,
			url: songInfo.videoDetails.video_url,
		};

		if (playingSong == null) {
			const newPlayingSong = {
				connection: null,
				player: createAudioPlayer()
			};

			try {
				const voiceChannel = interaction.member.voice.channel;

				newPlayingSong.connection = joinVoiceChannel({
					channelId: voiceChannel.id,
					guildId: guild_id,
					adapterCreator: voiceChannel.guild.voiceAdapterCreator
				});

				play(queue, newPlayingSong, interaction, song);
			} catch (err) {
				console.log(err);
				playingSong = null;
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
	interaction.reply(`The queue has been cleared!`);
}

function skip(playingSong, interaction) {
	interaction.reply(`Skipping!`);
	playingSong.player.stop();
}

function play(queue, playingSong, interaction, song) {
	if (interaction) {
		interaction.reply('Yezzir playing: ' + song.url);
	}

	const stream = ytdl(song.url, {
		quality: 'highestaudio',
		highWaterMark: 1 << 25
	})
	playingSong.player.play(createAudioResource(stream, { inputType: StreamType.Arbitrary }));
	playingSong.player.on(AudioPlayerStatus.Idle, () => playNextSong(queue))
	playingSong.connection.subscribe(playingSong.player);
}

function playNextSong(queue) {
	if (queue.length > 0) {
		play(queue, null, queue.shift());
		console.log(queue);
	}
}

client.login(token);