const { Client, Intents } = require('discord.js');
const { createAudioResource, createAudioPlayer, joinVoiceChannel, StreamType, AudioPlayerStatus } = require('@discordjs/voice');
const {
	prefix,
	token,
	spotify_client_id,
	spotify_client_secret,
	youtube_api_key
} = require('./config.json');
const ytdl = require('ytdl-core');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

const axios = require('axios');

var playingSong = null;
var queue = [];

client.once('ready', () => {
	console.log('Ready!');
});

client.once('reconnecting', () => {
	console.log('Reconnecting!');
});

client.once('disconnect', () => {
	console.log('Disconnect!');
});

client.on('messageCreate', async message => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	if (message.content.startsWith(`${prefix}play`)) {
		execute(message);
		return;
	} else if (message.content.startsWith(`${prefix}skip`)) {
		skip(message);
		return;
	} else if (message.content.startsWith(`${prefix}clear`)) {
		clear(message);
		return;
	} else {
		message.channel.send('???')
	}
});

function execute(message) {
	const url = message.content.substring(message.content.indexOf(' ') + 1, message.content.length);

	if (url.includes("open.spotify.com")) {
		searchSpotify(url, message);
	} else if (url.includes("youtube.com")) {
		playUrl(url, message);
	} else {
		searchYoutube(url + " audio", message);
	}
}

function searchSpotify(url, message) {
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
					searchYoutube(query, message);
				})
				.catch(error => {
					console.error(error);
				})

		})
		.catch(error => {
			console.error(error)
		})
}

function searchYoutube(query, message) {
	axios
		.get("https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=" + encodeURIComponent(query) + "&key=" + youtube_api_key)
		.then(res => {
			const youtubeVideoId = res.data.items[0].id.videoId;
			playUrl("https://www.youtube.com/watch?v=" + youtubeVideoId, message);
		})
		.catch(error => {
			console.error(error)
		})
}

function playUrl(url, message) {
	ytdl.getInfo(url).then((songInfo) => {
		const song = {
			title: songInfo.videoDetails.title,
			url: songInfo.videoDetails.video_url,
		};
	
		if (playingSong == null) {
			playingSong = {
				connection: null,
				player: createAudioPlayer()
			};
	
			try {
				playingSong.connection = joinVoiceChannel({
					channelId: message.member.voice.channel.id,
					guildId: message.guild.id,
					adapterCreator: message.guild.voiceAdapterCreator
				});
	
				play(message, song);
			} catch (err) {
				console.log(err);
				playingSong = null;
				return message.channel.send(err);
			}
		} else {
			queue.push(song);
			console.log(queue);
			return message.channel.send(`${song.title} has been added to the queue!`);
		}
	  });
}

function clear(message) {
	if (!message.member.voice.channel || queue.length == 0) return;
	queue = [];
	console.log(queue);
	return message.channel.send(`The queue has been cleared!`);
}

function skip(message) {
	if (playingSong != null) {
		message.channel.send(`Skipping!`);
		playingSong.player.stop();
	}
}

function play(message, song) {
	message.channel.send('Yezzir playing: ' + song.url);

	const stream = ytdl(song.url, {
		quality: 'highestaudio',
		highWaterMark: 1 << 25
	})
	playingSong.player.play(createAudioResource(stream, { inputType: StreamType.Arbitrary }));
	playingSong.player.on(AudioPlayerStatus.Idle, () => playNextSong(message))
	playingSong.connection.subscribe(playingSong.player);
}

function playNextSong(message) {
	if (queue.length > 0) {
		play(message, queue.shift());
		console.log(queue);
	} else {
		playingSong = null;
	}
}

client.login(token);