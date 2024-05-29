const { spotify_client_id, spotify_client_secret } = require("./config.json");
const axios = require("axios");
const url = require('url');

function getAccessToken(callback) {
    const base64 = Buffer.from(`${spotify_client_id}:${spotify_client_secret}`).toString("base64");
    const config = {
        headers: {
            "Authorization": `Basic ${base64}`
        }
    };

    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");

    axios
        .post("https://accounts.spotify.com/api/token", params, config)
        .then(res => {
            const accessToken = res.data.access_token;
            callback(accessToken);
        })
        .catch(error => {
            console.error(error);
        });
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

module.exports = {
    getSongMetadata: function (songUrl, onMetadataReceived) {
        getAccessToken((accessToken) => {
            const trackId = url.parse(songUrl, true).pathname.split("/").slice(-1)[0];

            axios
                .get(`https://api.spotify.com/v1/tracks/${trackId}`, { headers: { "Authorization": `Bearer ${accessToken}` } })
                .then(res => {
                    const trackName = res.data.name;
                    const artist = res.data.artists[0].name;
                    onMetadataReceived(trackName, artist);
                })
                .catch(error => {
                    console.error(error);
                });
        })
    },
    getPlaylistMetadata: function (playlistUrl, onMetadataReceived) {
        getAccessToken((accessToken) => {
            const playlistId = url.parse(playlistUrl, true).pathname.split("/").slice(-1)[0];

            axios
                .get(`https://api.spotify.com/v1/playlists/${playlistId}`, { headers: { "Authorization": `Bearer ${accessToken}` } })
                .then(res => {
                    const items = res.data.tracks.items;
                    const tracks = items.map((item) => {
                        return { name: item.track.name, artist: item.track.artists[0].name };
                    });
                    onMetadataReceived(tracks);
                })
                .catch(error => {
                    console.error(error);
                });
        });
    },
    getAlbumMetadata: function (albumUrl, onMetadataReceived) {
        getAccessToken((accessToken) => {
            const albumId = url.parse(albumUrl, true).pathname.split("/").slice(-1)[0];

            axios
                .get(`https://api.spotify.com/v1/albums/${albumId}`, { headers: { "Authorization": `Bearer ${accessToken}` } })
                .then(res => {
                    const items = res.data.tracks.items;
                    const tracks = items.map((item) => {
                        return { name: item.name, artist: item.artists[0].name };
                    });
                    onMetadataReceived(tracks);
                })
                .catch(error => {
                    console.error(error);
                });
        });
    },
    getRecommendations: function (query, category, onMetadataReceived) {
        getAccessToken((accessToken) => {
            const totalLimit = 5
            const offset = category == "genre" ? getRandomInt(0, 100) : 0;
            const limit = category == "artist" ? 30 : totalLimit;
            axios
                .get(`https://api.spotify.com/v1/search?q=${category}:"${query}"&type=track&market=CA&limit=${limit}&offset=${offset}`, { headers: { "Authorization": `Bearer ${accessToken}` } })
                .then(res => {
                    const items = res.data.tracks.items;
                    const metadata = items.map((item) => {
                        return { name: item.name, artist: item.artists[0].name };
                    });

                    if (category == "artist") {
                        shuffle(metadata);
                    }

                    onMetadataReceived(category == "artist" ? metadata.slice(0, totalLimit) : metadata);
                })
                .catch(error => {
                    console.error(error);
                });
        })
    }
}