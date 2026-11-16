"""Мінімальний клієнт Supabase (PostgREST + Auth) на httpx.

Працює і з новими ключами (sb_secret_...), і з legacy service_role (eyJ...).
"""
from __future__ import annotations

from typing import Any

import httpx


class Supabase:
    def __init__(self, url: str, key: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        headers = {"apikey": key}
        if key.startswith("eyJ"):            # legacy JWT-ключ іде ще й в Authorization
            headers["Authorization"] = f"Bearer {key}"
        self._key = key
        self._url = url
        self.http = httpx.AsyncClient(base_url=url, headers=headers, timeout=20, transport=transport)

    async def close(self) -> None:
        await self.http.aclose()

    # ---------- PostgREST ----------

    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        r = await self.http.get(f"/rest/v1/{table}", params=params)
        r.raise_for_status()
        return r.json()

    async def insert(self, table: str, rows: dict | list[dict], *, upsert_on: str | None = None,
                     ignore_duplicates: bool = False, returning: bool = False) -> list[dict[str, Any]]:
        prefer = ["return=representation" if returning else "return=minimal"]
        params = {}
        if upsert_on:
            prefer.append("resolution=merge-duplicates")
            params["on_conflict"] = upsert_on
        elif ignore_duplicates:
            prefer.append("resolution=ignore-duplicates")
        r = await self.http.post(f"/rest/v1/{table}", json=rows, params=params,
                                 headers={"Prefer": ",".join(prefer)})
        r.raise_for_status()
        return r.json() if returning else []

    async def count(self, table: str, params: dict[str, str] | None = None) -> int:
        r = await self.http.get(f"/rest/v1/{table}", params={"select": "*", "limit": "1", **(params or {})},
                                headers={"Prefer": "count=exact"})
        r.raise_for_status()
        return int(r.headers.get("content-range", "*/0").rsplit("/", 1)[-1])

    async def update(self, table: str, params: dict[str, str], values: dict) -> None:
        r = await self.http.patch(f"/rest/v1/{table}", params=params, json=values,
                                  headers={"Prefer": "return=minimal"})
        r.raise_for_status()

    async def delete(self, table: str, params: dict[str, str]) -> None:
        r = await self.http.delete(f"/rest/v1/{table}", params=params)
        r.raise_for_status()

    # ---------- Auth ----------

    async def user_id_from_token(self, access_token: str) -> str | None:
        """Перевіряє access_token користувача сайту (supabase.auth) і повертає його id."""
        r = await self.http.get("/auth/v1/user", headers={"Authorization": f"Bearer {access_token}"})
        if r.status_code != 200:
            return None
        return r.json().get("id")
