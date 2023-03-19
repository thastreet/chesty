const { youtube_api_key } = require("./config.json");
const axios = require("axios");

module.exports = {
    getVideoId: function (query, onIdReceived) {
        axios
            .get(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${encodeURIComponent(query)}&key=${youtube_api_key}`)
            .then(res => {
                onIdReceived(res.data.items[0].id.videoId);
            })
            .catch(error => {
                console.error(error);
            });
    }
}