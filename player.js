const { createAudioResource, joinVoiceChannel, StreamType, AudioPlayerStatus } = require("@discordjs/voice");
const ytdl = require("ytdl-core");
const { guild_id } = require("./config.json");

const { getSongMetadata, getPlaylistMetadata, getAlbumMetadata, getRecommendations } = require("./spotify.js");
const { getVideoId, getPlaylistIds } = require("./youtube.js");

const moment = require("moment");

const CommandNames = {
    Play: "play",
    Skip: "skip",
    Clear: "clear",
    Stop: "stop",
    Recommendations: "recommendations"
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
        } else if (interaction.commandName === CommandNames.Recommendations) {
            recommendations(queue, interaction, interaction.options.getString("query"), interaction.options.getString("category"), player);
        }

        listenForInteraction(client, queue, player);
    });
}

module.exports = {
    listenForInteraction: listenForInteraction,
    CommandNames: CommandNames
};

function queryVideoId(query, onIdReceived) {
    getVideoId(`${query} audio`, onIdReceived);
}

function resolveQuery(queue, interaction, query, player) {
    if (query.includes("open.spotify.com")) {
        if (query.includes("/playlist")) {
            getPlaylistMetadata(query, (tracks) => {
                const songs = tracks.map((track) => {
                    return { type: "track", data: track };
                });
                playSongs(songs, queue, interaction, player)
            });
        } else if (query.includes("/album")) {
            getAlbumMetadata(query, (tracks) => {
                const songs = tracks.map((track) => {
                    return { type: "track", data: track };
                });
                playSongs(songs, queue, interaction, player)
            });
        } else {
            getSongMetadata(query, (trackName, artist) => {
                queryVideoId(`${artist} ${trackName}`, (videoId) => {
                    playYoutubeUrl(getYoutubeUrl(videoId), queue, interaction, player);
                });
            });
        }
    } else if (query.includes("youtube.com") && query.includes("list=")) {
        getPlaylistIds(query, (ids) => {
            const songs = ids.map((id) => {
                return { type: "url", data: getYoutubeUrl(id) };
            });
            playSongs(songs, queue, interaction, player);
        });
    } else if (query.includes("youtube.com")) {
        playYoutubeUrl(query, queue, interaction, player);
    } else {
        queryVideoId(query, (videoId) => {
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

function recommendations(queue, interaction, query, category, player) {
    getRecommendations(query, category, (tracks) => {
        const songs = tracks.map((track) => {
            return { type: "track", data: track };
        });

        var messagePrefix = `Found ${songs.length} ${query} recommendations:\n`;
        for (song of songs) {
            messagePrefix += `${song.data.artist} - ${song.data.name}\n`;
        }

        playSongs(songs, queue, interaction, player, messagePrefix)
    });
}

function getYoutubeUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`
}

function playYoutubeUrl(url, queue, interaction, player) {
    const song = { type: "url", data: url };
    playSongs([song], queue, interaction, player);
}

function playSongs(songs, queue, interaction, player, messagePrefix = "") {
    const firstSong = songs.slice(0, 1)[0];

    if (firstSong == undefined) {
        sendMessage(`${messagePrefix}\nNothing to play`, interaction);
        return;
    }

    const otherSongs = songs.slice(1, songs.length);

    const newQueue = [];

    if (player.state.status != AudioPlayerStatus.Idle) {
        newQueue.push(firstSong);
    }

    newQueue.push(...otherSongs);

    queue.push(...newQueue);

    if (player.state.status == AudioPlayerStatus.Idle) {
        joinVoiceChannelAndPlaySong(firstSong, queue, interaction, player, newQueue.length, messagePrefix);
    } else if (newQueue.length == 1) {
        const song = newQueue[0];
        const id = song.type == "url" ? song.data : (song.type == "track" ? song.data.name : "");

        sendMessage(`${messagePrefix}\nAdded ${id} to queue`, interaction);
    } else {
        sendMessage(`${messagePrefix}\nAdded ${newQueue.length} songs to queue`, interaction);
    }
}

function joinVoiceChannelAndPlaySong(song, queue, interaction, player, addedCount, messagePrefix = "") {
    try {
        const voiceChannel = interaction.member.voice.channel;

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild_id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator
        });

        const playNextSong = () => {
            if (queue.length > 0) {
                playSong(queue.shift(), interaction, connection, player, playNextSong, 0, false);
            } else {
                console.log("No more songs to play");
            }
        };

        playSong(song, interaction, connection, player, playNextSong, addedCount, true, messagePrefix);
    } catch (err) {
        console.error(err);
    }
}

async function playSong(song, interaction, connection, player, playNextSong, addedCount, initialInteraction, messagePrefix = "") {
    if (song.type == "url") {
        const url = song.data;
        const baseMessage = `${messagePrefix}\nPlaying: ${url}` + (addedCount > 0 ? `, added ${addedCount} songs to queue` : "");

        var interactionToReply;

        if (initialInteraction) {
            const interactionResponse = await sendMessage(baseMessage, interaction);
            interactionToReply = interactionResponse.interaction;
        } else {
            interaction.editReply({ content: baseMessage, components: [] });
            interactionToReply = interaction;
        }

        var lengthSeconds = "0";

        const stream = ytdl(url, {
            quality: "highestaudio",
            filter: 'audioonly',
            highWaterMark: 1 << 25
        }).on('info', (info) => {
            lengthSeconds = info.videoDetails.lengthSeconds;
        });

        player.play(createAudioResource(stream, { inputType: StreamType.Arbitrary }));
        player.removeAllListeners();

        var timerId;

        player.on(AudioPlayerStatus.Idle, () => {
            if (timerId) {
                clearInterval(timerId);
            }

            playNextSong();
        });

        player.on(AudioPlayerStatus.Playing, () => {
            timerId = setInterval(playbackTimer, 1000);

            function playbackTimer() {
                const playbackDurationMs = player.state.playbackDuration;
                const totalDurationMs = Number(lengthSeconds) * 1000;
                const playbackPercent = playbackDurationMs / totalDurationMs * 100;

                const progressLength = 30;
                var progressBar = "[";

                for (var i = 0; i < progressLength; i++) {
                    progressBar += playbackPercent < (i / (progressLength - 1) * 100) ? "░" : "▓";
                }

                progressBar += "]";

                const progressMessage = moment.utc(playbackDurationMs).format('mm:ss') + "  " + progressBar + "  " + moment.utc(totalDurationMs).format('mm:ss');

                interactionToReply.editReply({ content: baseMessage + "\n" + progressMessage, components: [] });
            }
        });

        connection.subscribe(player);
    } else if (song.type == "track") {
        const query = song.data.artist + " - " + song.data.name;
        queryVideoId(query, (videoId) => {
            const song = { type: "url", data: getYoutubeUrl(videoId) };
            playSong(song, interaction, connection, player, playNextSong, addedCount, initialInteraction, messagePrefix);
        });
    }
}

async function sendMessage(message, interaction) {
    console.log(message);
    if (interaction) {
        return await interaction.reply(message);
    }
}