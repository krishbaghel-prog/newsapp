const express = require("express");
const axios = require("axios");

const router = express.Router();

function mapVideoWarning(err) {
  const status = err?.response?.status;
  const providerMessage =
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    "Video search failed.";

  if (status === 403 && providerMessage.toLowerCase().includes("ip address restriction")) {
    return "The current YOUTUBE_API_KEY is IP-restricted. Remove the IP restriction or allow the server IP in Google Cloud.";
  }

  if (status === 403) {
    return `YouTube rejected the API key: ${providerMessage}`;
  }

  if (status === 400 || status === 401) {
    return `YouTube API configuration issue: ${providerMessage}`;
  }

  return `Video search is temporarily unavailable: ${providerMessage}`;
}

// GET /api/videos?q=&maxResults=
router.get("/", async (req, res, next) => {
  const q = String(req.query.q || "latest news");

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const maxResults = Math.max(1, Math.min(20, Number(req.query.maxResults || 10)));

    if (!apiKey) {
      return res.json({
        q,
        items: [],
        warning: "Add YOUTUBE_API_KEY to backend/.env to enable live YouTube video search."
      });
    }

    const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        key: apiKey,
        part: "snippet",
        q,
        type: "video",
        order: "date",
        safeSearch: "moderate",
        maxResults
      },
      timeout: 15000
    });

    const items = (response.data?.items || []).map((item) => ({
      id: item?.id?.videoId,
      title: item?.snippet?.title,
      channelTitle: item?.snippet?.channelTitle,
      publishedAt: item?.snippet?.publishedAt,
      thumbnail:
        item?.snippet?.thumbnails?.high?.url ||
        item?.snippet?.thumbnails?.medium?.url ||
        item?.snippet?.thumbnails?.default?.url ||
        "",
      url: item?.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : ""
    }));

    res.json({ q, items });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return res.json({
        q,
        items: [],
        warning: mapVideoWarning(err)
      });
    }

    next(err);
  }
});

module.exports = router;
