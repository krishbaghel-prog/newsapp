const axios = require("axios");
const { clampWords } = require("../srclib/text");

let unavailableUntil = 0;

function isUnavailable() {
  return Date.now() < unavailableUntil;
}

function markUnavailable(err) {
  const status = err?.response?.status;
  if ([401, 403, 404, 429].includes(status)) {
    unavailableUntil = Date.now() + 5 * 60 * 1000;
  }
}

function getGrokConfig() {
  const apiKey = process.env.GROK_API_KEY;
  const baseURL = process.env.GROK_BASE_URL || "https://api.x.ai/v1";
  const model = process.env.GROK_MODEL || "grok-4.20-reasoning";
  return { apiKey, baseURL, model };
}

async function grokSummarize({ title, text }) {
  const { apiKey, baseURL, model } = getGrokConfig();
  if (!apiKey || isUnavailable()) return null;

  const prompt =
    "Summarize the news into a crisp short-form blurb of 50-70 words. " +
    "No hashtags, no bullet points, no emojis. Output only the summary text.";

  const input = `TITLE: ${title || ""}\nTEXT: ${text || ""}`.trim();

  try {
    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: input }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const raw = response.data?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    return clampWords(raw, 50, 70);
  } catch (err) {
    markUnavailable(err);
    return null;
  }
}

async function grokChat({ system, messages, temperature = 0.2 }) {
  const { apiKey, baseURL, model } = getGrokConfig();
  if (!apiKey || isUnavailable()) {
    const err = new Error("Missing GROK_API_KEY");
    err.status = 400;
    throw err;
  }

  try {
    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          ...(messages || [])
        ],
        temperature
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    const raw = response.data?.choices?.[0]?.message?.content?.trim();
    return raw || "";
  } catch (err) {
    markUnavailable(err);
    throw err;
  }
}

module.exports = { grokSummarize, grokChat };
