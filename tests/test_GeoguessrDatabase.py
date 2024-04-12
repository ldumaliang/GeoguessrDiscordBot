import sys
import unittest

import sys
import os

sys.path.append("app")

from GeoguessrDatabase import GeoguessrDatabase

class TestGeoguessrDatabase(unittest.TestCase):
    def setUp(self):
        self.db = GeoguessrDatabase(':memory:')  # Use an in-memory database for testing

    def tearDown(self):
        self.db.close()

    def test_update_challenge_token(self):
        # Test updating challenge token that doesn't exist
        token = 'new_token'
        self.assertTrue(self.db.update_challenge_token(token))

        # Test updating challenge token that already exists
        self.assertFalse(self.db.update_challenge_token(token))

    def test_get_todays_challenge(self):
        # Test getting today's challenge when there are no challenges
        self.assertIsNone(self.db.get_todays_challenge())

        # Test getting today's challenge when there is a challenge
        token = 'new_token'
        self.db.update_challenge_token(token)
        challenge_id, challenge_token = self.db.get_todays_challenge()
        self.assertEqual(challenge_token, token)

    def test_get_user_by_geo_id(self):
        # Test getting user by Geo ID that doesn't exist
        geo_id = 'non_existing_id'
        self.assertIsNone(self.db.get_user_by_geo_id(geo_id))

        # Test getting user by Geo ID that exists
        geo_id = 'existing_id'
        self.db.c.execute("INSERT INTO User (GeoId, GeoName) VALUES (?, ?)", (geo_id, 'John Doe'))
        self.db.conn.commit()  # Commit the transaction
        user = self.db.get_user_by_geo_id(geo_id)
        self.assertEqual(user[1], geo_id)

    # Add more test methods for other methods in the GeoguessrDatabase class

if __name__ == '__main__':
    unittest.main()