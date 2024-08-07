const { createAudioResource, joinVoiceChannel, StreamType, AudioPlayerStatus } = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core");
const { guild_id } = require("./config.json");

const { getMetadata } = require("./spotify.js");
const { getVideoId, getPlaylistIds } = require("./youtube.js");

const CommandNames = {
    Play: "play",
    Skip: "skip",
    Clear: "clear",
    Stop: "stop"
};

function listenForInteraction(client, queue, player) {
    client.once("interactionCreate", async interaction => {
        if (interaction.commandName === CommandNames.Play) {
            resolveQuery(queue, interaction, interaction.options.getString("query"), player);
        } else if (interaction.commandName === CommandNames.Skip) {
            skip(player, interaction);
        } else if (interaction.commandName === CommandNames.Clear) {
            clear(queue, interaction);
        } else if (interaction.commandName === CommandNames.Stop) {
            stop(queue, player, interaction);
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
                playYoutubeUrl(getYoutubeUrl(videoId), queue, interaction, player);
            });
        });
    } else if (query.includes("youtube.com") && query.includes("list=")) {
        getPlaylistIds(query, (ids) => {
            const urls = ids.map((id) => {
                return getYoutubeUrl(id);
            });
            playYoutubeUrls(urls, queue, interaction, player);
        });
    } else if (query.includes("youtube.com")) {
        playYoutubeUrl(query, queue, interaction, player);
    } else {
        getVideoId(`${query} audio`, (videoId) => {
            playYoutubeUrl(getYoutubeUrl(videoId), queue, interaction, player);
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

function stop(queue, player, interaction) {
    clear(queue, null);
    player.stop();
    sendMessage("Stopped", interaction);
}

function getYoutubeUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`
}

function playYoutubeUrl(url, queue, interaction, player) {
    playYoutubeUrls([url], queue, interaction, player);
}

function playYoutubeUrls(urls, queue, interaction, player) {
    const firstSong = urls.slice(0, 1)[0];
    const otherSongs = urls.slice(1, urls.length);

    const newQueue = [];

    if (player.state.status != AudioPlayerStatus.Idle) {
        newQueue.push(firstSong);
    }

    newQueue.push(...otherSongs);

    queue.push(...newQueue);

    if (player.state.status == AudioPlayerStatus.Idle) {
        joinVoiceChannelAndPlaySong(firstSong, queue, interaction, player, newQueue);
    } else if (newQueue.length == 1) {
        sendMessage(`Added ${newQueue[0]} to queue`, interaction);
    } else {
        sendMessage(`Added ${newQueue.length} songs to queue`, interaction);
    }
}

function joinVoiceChannelAndPlaySong(url, queue, interaction, player, newQueue) {
    try {
        const voiceChannel = interaction.member.voice.channel;

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild_id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator
        });

        const playNextSong = () => {
            if (queue.length > 0) {
                playSong(queue.shift(), null, connection, player, playNextSong, []);
            } else {
                console.log("No more songs to play");
            }
        };

        playSong(url, interaction, connection, player, playNextSong, newQueue);
    } catch (err) {
        console.error(err);
    }
}

function playSong(url, interaction, connection, player, playNextSong, newQueue) {
    sendMessage(`Playing: ${url}` + (newQueue.length > 0 ? `, added ${newQueue.length} songs to queue` : ""), interaction);

    const stream = ytdl(url, {
        quality: "highestaudio",
        filter: 'audioonly',
        highWaterMark: 1 << 25
    });

    player.play(createAudioResource(stream, { inputType: StreamType.Arbitrary }));
    player.removeAllListeners();
    player.on(AudioPlayerStatus.Idle, playNextSong);
    connection.subscribe(player);
}

function sendMessage(message, interaction) {
    console.log(message);
    if (interaction) {
        interaction.reply(message);
    }
}