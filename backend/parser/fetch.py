"""Page downloads, done politely: a pause between requests and a clear User-Agent."""
from __future__ import annotations

import time

import httpx

HEADERS = {
    "User-Agent": "EventeraBot/0.1 (student project, Lviv events aggregator)",
    "Accept-Language": "uk,en;q=0.8",
}
DELAY_SECONDS = 1.0  # pause between requests so we don't overload other people's sites

_last_request = 0.0


def get_html(url: str) -> str:
    global _last_request
    wait = DELAY_SECONDS - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    resp = httpx.get(url, headers=HEADERS, timeout=20, follow_redirects=True)
    _last_request = time.monotonic()
    resp.raise_for_status()
    return resp.text
