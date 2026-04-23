const axios = require("axios");
const { clampWords } = require("../srclib/text");

const SUPPORTED_PROVIDERS = ["grok", "openai", "claude", "gemini"];

function normalizeProviderName(value) {
  const provider = String(value || "").toLowerCase().trim();
  if (provider === "anthropic") return "claude";
  if (provider === "google") return "gemini";
  if (provider === "xai") return "grok";
  return provider;
}

function getEnvValue(...names) {
  for (const name of names) {
    const raw = process.env[name];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
}

function getProvider() {
  return normalizeProviderName(process.env.AI_PROVIDER || "grok");
}

function getFallbackProviders() {
  const raw = String(process.env.AI_FALLBACKS || "")
    .split(",")
    .map((s) => normalizeProviderName(s))
    .filter(Boolean);

  return raw.filter((provider, index) => {
    return SUPPORTED_PROVIDERS.includes(provider) && raw.indexOf(provider) === index;
  });
}

function isProviderConfigured(provider) {
  if (provider === "grok") return Boolean(getEnvValue("GROK_API_KEY"));
  if (provider === "openai") return Boolean(getEnvValue("OPENAI_API_KEY"));
  if (provider === "claude")
    return Boolean(getEnvValue("ANTHROPIC_API_KEY", "ANTRHOPIC_API_KEY"));
  if (provider === "gemini") return Boolean(getEnvValue("GEMINI_API_KEY"));
  return false;
}

function buildProviderChain() {
  const primary = getProvider();
  if (!SUPPORTED_PROVIDERS.includes(primary)) {
    throw toError("Invalid AI_PROVIDER. Use one of: grok, openai, claude, gemini");
  }

  const configured = SUPPORTED_PROVIDERS.filter(isProviderConfigured);
  const chain = [primary, ...getFallbackProviders(), ...configured];
  return chain.filter((provider, index) => chain.indexOf(provider) === index);
}

function toError(msg) {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

function normalizeMessages({ system, messages }) {
  const out = [];
  if (system) out.push({ role: "system", content: String(system) });
  for (const message of messages || []) {
    if (!message?.content) continue;
    out.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content)
    });
  }
  return out;
}

function uniqueCandidates(candidates) {
  return candidates.filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index);
}

async function chatWithGrok({ system, messages, temperature }) {
  const apiKey = getEnvValue("GROK_API_KEY");
  const baseURL = process.env.GROK_BASE_URL || "https://api.x.ai/v1";
  if (!apiKey) throw toError("Missing GROK_API_KEY");

  const models = uniqueCandidates([
    process.env.GROK_MODEL,
    "grok-4.20-reasoning",
    "grok-2-latest"
  ]);

  let lastErr = null;
  for (const model of models) {
    try {
      const response = await axios.post(
        `${baseURL}/chat/completions`,
        {
          model,
          messages: normalizeMessages({ system, messages }),
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

      return response.data?.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      lastErr = err;
      if (err?.response?.status !== 404) throw err;
    }
  }

  throw lastErr || toError("xAI request failed");
}

async function chatWithOpenAI({ system, messages, temperature }) {
  const apiKey = getEnvValue("OPENAI_API_KEY");
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (!apiKey) throw toError("Missing OPENAI_API_KEY");

  const response = await axios.post(
    `${baseURL}/chat/completions`,
    {
      model,
      messages: normalizeMessages({ system, messages }),
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

  return response.data?.choices?.[0]?.message?.content?.trim() || "";
}

async function chatWithClaude({ system, messages, temperature }) {
  const apiKey = getEnvValue("ANTHROPIC_API_KEY", "ANTRHOPIC_API_KEY");
  const baseURL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  if (!apiKey) throw toError("Missing ANTHROPIC_API_KEY");

  const anthropicMessages = (messages || []).map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content || "")
  }));

  const response = await axios.post(
    `${baseURL}/messages`,
    {
      model,
      system: system || "",
      messages: anthropicMessages,
      max_tokens: 900,
      temperature
    },
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      timeout: 20000
    }
  );

  const firstText = response.data?.content?.find((item) => item?.type === "text")?.text;
  return String(firstText || "").trim();
}

async function chatWithGemini({ system, messages, temperature }) {
  const apiKey = getEnvValue("GEMINI_API_KEY");
  const baseURL = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  if (!apiKey) throw toError("Missing GEMINI_API_KEY");

  const combined = normalizeMessages({ system, messages })
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  const models = uniqueCandidates([
    process.env.GEMINI_MODEL,
    "gemini-2.0-flash",
    "gemini-1.5-flash"
  ]);

  let lastErr = null;
  for (const model of models) {
    try {
      const response = await axios.post(
        `${baseURL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          contents: [{ parts: [{ text: combined }] }],
          generationConfig: { temperature }
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 20000
        }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return String(text || "").trim();
    } catch (err) {
      lastErr = err;
      if (err?.response?.status !== 404) throw err;
    }
  }

  throw lastErr || toError("Gemini request failed");
}

async function aiChat({ system, messages, temperature = 0.2 }) {
  const chain = buildProviderChain();

  let lastErr = null;
  for (const provider of chain) {
    try {
      if (provider === "grok") return await chatWithGrok({ system, messages, temperature });
      if (provider === "openai") return await chatWithOpenAI({ system, messages, temperature });
      if (provider === "claude") return await chatWithClaude({ system, messages, temperature });
      if (provider === "gemini") return await chatWithGemini({ system, messages, temperature });
    } catch (err) {
      lastErr = err;
    }
  }

  const details = lastErr?.message ? ` Last error: ${lastErr.message}` : "";
  throw toError(`All AI providers failed.${details}`);
}

async function aiSummarize({ title, text, fallback }) {
  const system =
    "Summarize the news into a crisp short-form blurb of 50-70 words. " +
    "No hashtags, no bullet points, no emojis. Output only the summary text.";

  const content = `TITLE: ${title || ""}\nTEXT: ${text || fallback || ""}`.trim();

  try {
    const summary = await aiChat({
      system,
      messages: [{ role: "user", content }],
      temperature: 0.2
    });

    return clampWords(summary || fallback || text || "", 50, 70);
  } catch {
    return clampWords(fallback || text || "", 50, 70);
  }
}

module.exports = { aiChat, aiSummarize, getProvider, getFallbackProviders };
