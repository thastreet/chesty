const { spotify_client_id, spotify_client_secret } = require("./config.json");
const axios = require("axios");
const url = require('url');

module.exports = {
    getSongMetadata: function (songUrl, onMetadataReceived) {
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
            .catch(error => {
                console.error(error)
            });
    },
    getPlaylistMetadata: function (playlistUrl, onMetadataReceived) {
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

            })
            .catch(error => {
                console.error(error)
            });
    },
    getAlbumMetadata: function (albumUrl, onMetadataReceived) {
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

            })
            .catch(error => {
                console.error(error)
            });
    }
}