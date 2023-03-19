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
            resolveQuery(queue, interaction, interaction.options.getString("query"), player);
        } else if (interaction.commandName === CommandNames.Skip) {
            skip(player, interaction);
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

function skip(player, interaction) {
    sendMessage("Skipping!", interaction);
    player.stop();
}

function clear(queue, interaction) {
    if (queue.length == 0) return;

    while (queue.length > 0) {
        queue.pop();
    }

    sendMessage("The queue has been cleared!", interaction);
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
            joinVoiceChannelAndPlaySong(song, queue, interaction, player);
        } else {
            addSongToQueue(song, queue, interaction);
        }
    });
}

function joinVoiceChannelAndPlaySong(song, queue, interaction, player) {
    try {
        const voiceChannel = interaction.member.voice.channel;

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild_id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator
        });

        const playNextSong = () => {
            if (queue.length > 0) {
                playSong(queue.shift(), null, connection, player, playNextSong);
            } else {
                console.log("No more songs to play");
            }
        };

        playSong(song, interaction, connection, player, playNextSong);
    } catch (err) {
        console.error(err);
    }
}

function addSongToQueue(song, queue, interaction) {
    queue.push(song);
    sendMessage(`Added to queue: ${song.title}`, interaction);
}

function playSong(song, interaction, connection, player, playNextSong) {
    console.log(`Playing: ${song.title}`);
    if (interaction) {
        interaction.reply(`Playing: ${song.url}`);
    }

    const stream = ytdl(song.url, {
        quality: "highestaudio",
        highWaterMark: 1 << 25
    });

    player.play(createAudioResource(stream, { inputType: StreamType.Arbitrary }));
    player.on(AudioPlayerStatus.Idle, playNextSong);
    connection.subscribe(player);
}

function sendMessage(message, interaction) {
    console.log(message);
    interaction.reply(message);
}