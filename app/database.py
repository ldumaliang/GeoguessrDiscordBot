"""Database access layer for the Geoguessr Discord bot."""

from __future__ import annotations

from pathlib import Path
import logging
import sqlite3

from app.constants import (
    SQL_INSERT_CHALLENGE,
    SQL_INSERT_USER_DAILY_RESULT,
    SQL_SELECT_ALL_CHALLENGES,
    SQL_SELECT_ALL_DAILY_RESULTS,
    SQL_SELECT_ALL_USERS,
    SQL_SELECT_CHALLENGE_BY_TOKEN,
    SQL_SELECT_TODAYS_CHALLENGE,
    SQL_SELECT_USER_BY_DISCORD_ID,
    SQL_SELECT_USER_BY_GEO_ID,
    SQL_SELECT_USER_DAILY_RESULT,
    SQL_SELECT_USER_DAILY_RESULT_BY_GEO_ID,
    SQL_UPDATE_USER_DISCORD,
)

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT_DIR / "database" / "geoguessr.db"
SCHEMA_PATH = ROOT_DIR / "database" / "schema.sql"


class GeoguessrDatabase:
    """Thin wrapper around sqlite3 for Geoguessr bot persistence."""

    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH) -> None:
        """Initialize a Database object.

        Args:
            db_path: Path to the sqlite database file.
        """
        try:
            self.conn = sqlite3.connect(Path(db_path))
            self.c = self.conn.cursor()
            self._setup()
        except Exception as exc:
            logging.error("Error occurred in Database initialization: %s", exc)

    def _setup(self) -> None:
        """Set up the database by creating the necessary tables if they don't exist."""
        with SCHEMA_PATH.open("r", encoding="utf-8") as file:
            schema = file.read()
            self.c.executescript(schema)

        self.conn.commit()

    def close(self) -> None:
        """Close the database connection."""
        self.conn.close()

    def update_challenge_token(self, token: str) -> bool:
        """Update the daily challenge token in the database.

        Args:
            token: The daily challenge token to update.

        Returns:
            True if the token was successfully updated, False otherwise.
        """
        try:
            self.c.execute(SQL_SELECT_CHALLENGE_BY_TOKEN, (token,))
            challenge_row = self.c.fetchone()
            if challenge_row is None:
                self.c.execute(SQL_INSERT_CHALLENGE, (token,))
                self.conn.commit()
                return True
            print("Challenge token already exists")
            return False
        except Exception as exc:
            logging.error("Error occurred in updating challenge token: %s", exc)
            return False

    def get_todays_challenge(self):
        """Retrieve the ID and token for the current daily challenge."""
        try:
            self.c.execute(SQL_SELECT_TODAYS_CHALLENGE)
            return self.c.fetchone()
        except Exception as exc:
            logging.error("Error occurred in getting today's challenge: %s", exc)
            return None

    def get_user_by_geo_id(self, geo_id):
        """Retrieve a user by their Geoguessr ID."""
        try:
            self.c.execute(SQL_SELECT_USER_BY_GEO_ID, (geo_id,))
            return self.c.fetchone()
        except Exception as exc:
            logging.error("Error occurred in getting user by GeoId: %s", exc)
            return None

    def get_user_by_discord_id(self, discord_id):
        """Retrieve a user by their Discord ID."""
        try:
            self.c.execute(SQL_SELECT_USER_BY_DISCORD_ID, (discord_id,))
            return self.c.fetchone()
        except Exception as exc:
            logging.error("Error occurred in getting user by DiscordId: %s", exc)
            return None

    def get_user_daily_result(self, user_id, challenge_id):
        """Retrieve a user's daily result for a specific challenge."""
        try:
            self.c.execute(SQL_SELECT_USER_DAILY_RESULT, (user_id, challenge_id))
            return self.c.fetchone()
        except Exception as exc:
            logging.error("Error occurred in getting user's daily result: %s", exc)
            return None

    def get_user_daily_result_by_geoid_and_challengeid(self, geo_id, challenge_id):
        """Retrieve a user's daily result for a specific challenge by Geo ID."""
        try:
            self.c.execute(SQL_SELECT_USER_DAILY_RESULT_BY_GEO_ID, (geo_id, challenge_id))
            return self.c.fetchone()
        except Exception as exc:
            logging.error("Error occurred in getting user's daily result: %s", exc)
            return None

    def add_user_daily_result(self, user_id, score, challenge_id) -> None:
        """Add a user's daily result to the database."""
        try:
            score_data = (user_id, score, challenge_id)
            self.c.execute(SQL_INSERT_USER_DAILY_RESULT, score_data)
            self.conn.commit()
        except Exception as exc:
            logging.error("Error occurred in adding user's daily result: %s", exc)

    def get_all_users(self):
        """Retrieve all users from the database."""
        self.c.execute(SQL_SELECT_ALL_USERS)
        return self.c.fetchall()

    def get_all_daily_results(self):
        """Retrieve all daily results from the database."""
        self.c.execute(SQL_SELECT_ALL_DAILY_RESULTS)
        return self.c.fetchall()

    def get_all_challenges(self):
        """Retrieve all challenges from the database."""
        self.c.execute(SQL_SELECT_ALL_CHALLENGES)
        return self.c.fetchall()

    def set_user_discord_id(self, geo_name, discord_id, discord_name) -> bool:
        """Set the Discord ID for a user in the database."""
        try:
            self.c.execute(SQL_UPDATE_USER_DISCORD, (discord_id, discord_name, geo_name))
            self.conn.commit()
            return self.c.rowcount != 0
        except Exception as exc:
            logging.error("Error occurred in setting user's Discord ID: %s", exc)
            return False
