"""Geoguessr API queries and persistence helpers."""

from __future__ import annotations

import configparser

import requests

from app.constants import (
    BASE_V3_URL,
    DAILY_CHALLENGE_ENDPOINT,
    DAILY_CHALLENGE_STATUS_ENDPOINT,
    FRIENDS_SUMMARY_ENDPOINT,
    PROFILE_ENDPOINT,
    RESULTS_FLAGS_FRIENDS_LIMIT,
    RESULTS_HIGHSCORES_ENDPOINT,
    SIGN_IN_ENDPOINT,
    SQL_INSERT_USER,
    SQL_INSERT_USER_WITH_DISCORD,
    SQL_SELECT_USER_BY_GEO_ID,
)
from app.database import GeoguessrDatabase


class GeoguessrQueries:
    """Query helper for Geoguessr API and database updates."""

    def __init__(self, db: GeoguessrDatabase | None = None) -> None:
        """Initialize queries with a database connection."""
        self.db = db or GeoguessrDatabase()
        self.ncfa_token: str | None = None
        self.session: requests.Session | None = None

    def update_session(self) -> None:
        """Update the session with the necessary authentication token."""
        # self.ncfa_token = self._sign_in()
        self.ncfa_token = (
            "PbAWO6JE%2BSLbF5wsK0YCZNVOcMXaXy6sxA44fJYr6o4%3DhV7SXD9XAYlNiYnzGkLokeuWLYQg6%2FE3Vh8AkjtH73nvdi%2BUVaiWvaQ2demuwQ8x3BN1OMbQE8lgtgtoRBybWZrW3wsdR%2FkYCsZMwz7NRYM%3D"
        )
        self.session = requests.Session()
        self.session.cookies.set("_ncfa", self.ncfa_token, domain="www.geoguessr.com")

    def get_daily_challenge_token(self) -> bool:
        """Retrieve the token for the current daily challenge."""
        daily_challenge_url = f"{BASE_V3_URL}{DAILY_CHALLENGE_ENDPOINT}"
        response = requests.get(daily_challenge_url, timeout=30).json()
        token = response.get("token")

        success = self.db.update_challenge_token(token)

        print("Challenge Token:", token)
        return success

    def check_for_new_results(self) -> list | None:
        """Check for new results in the daily challenge and add them to the database."""
        if not self.session:
            print("Session is not initialized. Call update_session first.")
            return None

        daily_challenge_url = f"{BASE_V3_URL}{DAILY_CHALLENGE_STATUS_ENDPOINT}"
        try:
            daily_challenge_response = self.session.get(daily_challenge_url, timeout=30)
            daily_challenge_data = daily_challenge_response.json()
        except Exception as exc:
            print(f"Error occurred getting daily_challenge_data: {exc}")
            return None

        challenge_row = self.db.get_todays_challenge()
        if not challenge_row:
            return None

        challenge_id = int(challenge_row[0])

        new_results = []

        for item in daily_challenge_data.get("friends", []):
            try:
                user_id = item["id"]
                user = self.db.get_user_by_geo_id(user_id)
                if not user:
                    print(f"No user found with id: {user_id}")
                    continue

                user_id, _, user_geo_name, _, discord_id = user
                user_daily_result = self.db.get_user_daily_result(user_id, challenge_id)

                if not user_daily_result:
                    total_score = item["totalScore"]
                    self.db.add_user_daily_result(user_id, total_score, challenge_id)
                    new_results.append((user_geo_name, total_score, challenge_id, discord_id))
                    print(f"Added: {item['nick']} {total_score}")
            except Exception as exc:
                print(f"Error occurred: {exc}")

        return new_results

    def check_for_new_results_detailed(self) -> None:
        """Retrieve detailed daily challenge results and add them to the database."""
        if not self.session:
            print("Session is not initialized. Call update_session first.")
            return None

        print("Checking for new results...")

        challenge_row = self.db.get_todays_challenge()
        if not challenge_row:
            return None
        challenge_id = int(challenge_row[0])
        challenge_token = challenge_row[1]

        try:
            daily_challenge_results = self.session.get(
                f"{BASE_V3_URL}{RESULTS_HIGHSCORES_ENDPOINT}{challenge_token}{RESULTS_FLAGS_FRIENDS_LIMIT}",
                timeout=30,
            )
            daily_challenge_data = daily_challenge_results.json()
        except Exception as exc:
            print(f"Error occurred getting daily_challenge_results: {exc}")
            return None

        for item in daily_challenge_data.get("items", []):
            try:
                user = self.db.get_user_by_geo_id(item["userId"])
                if not user:
                    continue
                user_daily_result = self.db.get_user_daily_result(user[0], challenge_id)

                if user_daily_result is None or len(user_daily_result) == 0:
                    self.db.add_user_daily_result(user[0], item["totalScore"], challenge_id)
                    print("Added: ", item["playerName"], item["totalScore"])
            except Exception as exc:
                print(f"Error occurred: {exc}")

    def _sign_in(self) -> str | None:
        """Sign in to Geoguessr using the provided credentials."""
        sign_in_url = f"{BASE_V3_URL}{SIGN_IN_ENDPOINT}"

        config = configparser.ConfigParser()
        config.read("credentials.ini")
        username = config.get("Credentials", "Username").strip("'")
        password = config.get("Credentials", "Password").strip("'")

        sign_in_data = {
            "email": username,
            "password": password,
        }

        headers = {"Content-Type": "application/json"}
        try:
            sign_in_response = requests.post(sign_in_url, json=sign_in_data, headers=headers, timeout=30)

            cookie_jar = sign_in_response.cookies
            ncfa_token = cookie_jar.get("_ncfa")
            for cookie in cookie_jar:
                if cookie.name == "_ncfa":
                    _ = cookie.expires

        except Exception as exc:
            print(f"Error occurred signing in: {exc}")
            return None

        if sign_in_response.status_code != 200:
            raise Exception(f"Failed to sign in: {sign_in_response.status_code}")

        print(ncfa_token)
        return ncfa_token

    def update_friends(self) -> None:
        """Update users in the database with their Geoguessr usernames."""
        if not self.session:
            print("Session is not initialized. Call update_session first.")
            return None

        try:
            users_results = self.session.get(f"{BASE_V3_URL}{FRIENDS_SUMMARY_ENDPOINT}", timeout=30).json()
        except Exception as exc:
            print(f"Error occurred getting users_results: {exc}")
            return None

        for user in users_results.get("friends", []):
            self.db.c.execute(SQL_SELECT_USER_BY_GEO_ID, (user["userId"],))
            user_row = self.db.c.fetchone()

            if user_row is None:
                user_data = (user["userId"], user["nick"])
                self.db.c.execute(SQL_INSERT_USER, user_data)
                self.db.conn.commit()

        self_result = self.session.get(f"{BASE_V3_URL}{PROFILE_ENDPOINT}", timeout=30).json()
        profile_user = self_result["user"]
        if self.db.c.execute(SQL_SELECT_USER_BY_GEO_ID, (profile_user["id"],)).fetchone() is None:
            user_data = (profile_user["id"], profile_user["nick"], profile_user["nick"])
            self.db.c.execute(SQL_INSERT_USER_WITH_DISCORD, user_data)
            self.db.conn.commit()

    def get_db_data(self, table_name: str):
        """Retrieve all data from a specified table in the database."""
        try:
            self.db.c.execute(f"SELECT * FROM {table_name}")
            return self.db.c.fetchall()
        except Exception as exc:
            print(f"Error occurred in getting table data: {exc}")
            return None
