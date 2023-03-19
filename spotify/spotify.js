const { spotify_client_id, spotify_client_secret } = require("./config.json");
const axios = require("axios");

module.exports = {
    getSpotifyMetadata: function (url, onMetadataReceived) {
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

                const lastIndexOfSlash = url.lastIndexOf("/");
                const indexOfParams = url.lastIndexOf("?");
                const endIndex = indexOfParams != -1 ? indexOfParams : url.length;
                const trackId = url.substring(lastIndexOfSlash + 1, endIndex);

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
    }
}