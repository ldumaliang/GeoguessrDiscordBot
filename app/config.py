"""Configuration helpers for the Geoguessr Discord bot."""

from __future__ import annotations

from dataclasses import dataclass
import os

from dotenv import load_dotenv


@dataclass(frozen=True)
class BotConfig:
    """Runtime configuration for the Discord bot."""

    token: str
    guild_id: int


def load_config() -> BotConfig:
    """Load configuration from environment variables.

    Raises:
        RuntimeError: If a required environment variable is missing.
    """
    load_dotenv()

    token = os.getenv("DISCORD_TOKEN")
    guild_id_raw = os.getenv("GUILD_ID")

    if not token:
        raise RuntimeError("DISCORD_TOKEN is not set")
    if not guild_id_raw:
        raise RuntimeError("GUILD_ID is not set")

    try:
        guild_id = int(guild_id_raw)
    except ValueError as exc:
        raise RuntimeError("GUILD_ID must be an integer") from exc

    return BotConfig(token=token, guild_id=guild_id)
