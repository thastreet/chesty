const { createAudioResource, joinVoiceChannel, StreamType, AudioPlayerStatus } = require("@discordjs/voice");
const ytdl = require("ytdl-core");
const { guild_id } = require("./config.json");

const { getMetadata } = require("./spotify.js");
const { getVideoId } = require("./youtube.js");

const CommandNames = {
	Play: "play",
	Skip: "skip",
	Clear: "clear"
};

function listenForInteraction(client, queue, player) {
    client.once("interactionCreate", async interaction => {
        if (interaction.commandName === CommandNames.Play) {
            const query = interaction.options.getString("query");
            resolveQuery(queue, interaction, query, player);
        } else if (interaction.commandName === CommandNames.Skip) {
            interaction.reply("Skipping!");
            player.stop();
        } else if (interaction.commandName === CommandNames.Clear) {
            clear(queue, interaction);
        }

        listenForInteraction(client, queue, player);
    });
}

module.exports = {
    listenForInteraction: listenForInteraction,
    CommandNames: CommandNames
};

function resolveQuery(queue, interaction, query, player) {
	if (query.includes("open.spotify.com")) {
		getMetadata(query, (trackName, artist) => {
			getVideoId(`${artist} ${trackName} audio`, (videoId) => {
				playYoutubeVideoId(videoId, queue, interaction, player);
			});
		});
	} else if (query.includes("youtube.com")) {
		playYoutubeUrl(queue, query, interaction, player);
	} else {
		getVideoId(`${query} audio`, (videoId) => {
			playYoutubeVideoId(videoId, queue, interaction, player);
		});
	}
}

function playYoutubeVideoId(videoId, queue, interaction, player) {
	playYoutubeUrl(queue, `https://www.youtube.com/watch?v=${videoId}`, interaction, player);
}

function playYoutubeUrl(queue, url, interaction, player) {
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