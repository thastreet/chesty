const { youtube_api_key } = require("./config.json");
const axios = require("axios");
var url = require('url');

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
    },
    getPlaylistIds: function (query, onIdsReceived) {
        const listId = url.parse(query, true).query.list

        axios
            .get(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=25&playlistId=${listId}&key=${youtube_api_key}`)
            .then(res => {
                onIdsReceived(res.data.items.map((item) => {
                    return item.snippet.resourceId.videoId;
                }));
            })
            .catch(error => {
                console.error(error);
            });
    }
}