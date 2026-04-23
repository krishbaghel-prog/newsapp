from typing import Iterable, Optional
from urllib.parse import quote

import httpx

from app.config import Settings

_SUPPORTED = ("grok", "openai", "claude", "gemini")


def _fallbacks(settings: Settings) -> list[str]:
    raw = [s.strip().lower() for s in (settings.ai_fallbacks or "").split(",") if s.strip()]
    out: list[str] = []
    for p in raw:
        if p in _SUPPORTED and p not in out:
            out.append(p)
    return out


def _normalize_messages(system: Optional[str], messages: Iterable[dict]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if system:
        out.append({"role": "system", "content": str(system)})
    for m in messages:
        content = m.get("content")
        if not content:
            continue
        role = "assistant" if m.get("role") == "assistant" else "user"
        out.append({"role": role, "content": str(content)})
    return out


async def _chat_grok(*, system: Optional[str], messages: list[dict], temperature: float, settings: Settings) -> str:
    key = settings.grok_api_key
    if not key:
        raise ValueError("Missing GROK_API_KEY")

    payload = {
        "model": settings.grok_model,
        "messages": _normalize_messages(system, messages),
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(
            f"{settings.grok_base_url.rstrip('/')}/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        )
        res.raise_for_status()
        data = res.json()

    choices = data.get("choices") if isinstance(data, dict) else None
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message") if isinstance(choices[0], dict) else None
        if isinstance(msg, dict) and isinstance(msg.get("content"), str):
            return msg["content"].strip()
    return ""


async def _chat_openai(*, system: Optional[str], messages: list[dict], temperature: float, settings: Settings) -> str:
    key = settings.openai_api_key
    if not key:
        raise ValueError("Missing OPENAI_API_KEY")

    payload = {
        "model": settings.openai_model,
        "messages": _normalize_messages(system, messages),
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(
            f"{settings.openai_base_url.rstrip('/')}/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        )
        res.raise_for_status()
        data = res.json()

    choices = data.get("choices") if isinstance(data, dict) else None
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message") if isinstance(choices[0], dict) else None
        if isinstance(msg, dict) and isinstance(msg.get("content"), str):
            return msg["content"].strip()
    return ""


async def _chat_claude(*, system: Optional[str], messages: list[dict], temperature: float, settings: Settings) -> str:
    key = settings.anthropic_api_key
    if not key:
        raise ValueError("Missing ANTHROPIC_API_KEY")

    anthropic_messages = []
    for m in messages:
        if not m.get("content"):
            continue
        role = "assistant" if m.get("role") == "assistant" else "user"
        anthropic_messages.append({"role": role, "content": str(m["content"])})

    payload = {
        "model": settings.anthropic_model,
        "system": system or "",
        "messages": anthropic_messages,
        "max_tokens": 1200,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(
            f"{settings.anthropic_base_url.rstrip('/')}/messages",
            json=payload,
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
        )
        res.raise_for_status()
        data = res.json()

    parts = data.get("content") if isinstance(data, dict) else None
    if isinstance(parts, list):
        for p in parts:
            if isinstance(p, dict) and p.get("type") == "text" and isinstance(p.get("text"), str):
                return str(p["text"]).strip()
    return ""


async def _chat_gemini(*, system: Optional[str], messages: list[dict], temperature: float, settings: Settings) -> str:
    key = settings.gemini_api_key
    if not key:
        raise ValueError("Missing GEMINI_API_KEY")

    combined = "\n\n".join(
        f'{m["role"].upper()}: {m["content"]}' for m in _normalize_messages(system, messages)
    )

    url = (
        f"{settings.gemini_base_url.rstrip('/')}/models/{settings.gemini_model}:generateContent"
        f"?key={quote(key, safe='')}"
    )

    payload = {
        "contents": [{"parts": [{"text": combined}]}],
        "generationConfig": {"temperature": temperature},
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        res.raise_for_status()
        data = res.json()

    candidates = data.get("candidates") if isinstance(data, dict) else None
    if isinstance(candidates, list) and candidates:
        content = candidates[0].get("content") if isinstance(candidates[0], dict) else None
        parts = content.get("parts") if isinstance(content, dict) else None
        if isinstance(parts, list) and parts and isinstance(parts[0], dict):
            txt = parts[0].get("text")
            if isinstance(txt, str):
                return txt.strip()
    return ""


async def ai_chat(
    *,
    settings: Settings,
    system: Optional[str],
    messages: list[dict],
    temperature: float = 0.2,
) -> tuple[str, str]:
    primary = (settings.ai_provider or "openai").lower().strip()
    if primary not in _SUPPORTED:
        raise ValueError(f"Invalid AI_PROVIDER. Use one of: {', '.join(_SUPPORTED)}")

    chain = [primary, *_fallbacks(settings)]
    deduped: list[str] = []
    for p in chain:
        if p in _SUPPORTED and p not in deduped:
            deduped.append(p)

    last_err: Optional[BaseException] = None
    for provider in deduped:
        try:
            if provider == "grok":
                return await _chat_grok(system=system, messages=messages, temperature=temperature, settings=settings), provider
            if provider == "openai":
                return await _chat_openai(system=system, messages=messages, temperature=temperature, settings=settings), provider
            if provider == "claude":
                return await _chat_claude(system=system, messages=messages, temperature=temperature, settings=settings), provider
            if provider == "gemini":
                return await _chat_gemini(system=system, messages=messages, temperature=temperature, settings=settings), provider
        except BaseException as e:
            last_err = e

    detail = str(last_err) if last_err else ""
    raise RuntimeError(f"All AI providers failed. {detail}".strip())


def get_provider(settings: Settings) -> str:
    return (settings.ai_provider or "openai").lower().strip()
