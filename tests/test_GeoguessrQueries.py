import unittest
from unittest.mock import patch, MagicMock
from app.GeoguessrQueries import GeoguessrQueries
from datetime import datetime, timezone

class TestGeoguessrQueries(unittest.TestCase):

    @patch('app.GeoguessrQueries.requests.Session')
    @patch('app.GeoguessrQueries.os.getenv')
    def test_update_geoguessr_session(self, mock_getenv, mock_session):
        mock_getenv.return_value = 'fake_token'
        mock_requests_session = MagicMock()
        mock_session.return_value = mock_requests_session

        gq = GeoguessrQueries()
        gq.update_geoguessr_session()

        mock_getenv.assert_called_with('NCFA_TOKEN')
        mock_requests_session.cookies.set.assert_called_with("_ncfa", 'fake_token', domain="www.geoguessr.com")

    @patch('app.GeoguessrQueries.requests.get')
    @patch('app.GeoguessrQueries.session_scope')
    def test_get_daily_challenge_token(self, mock_session_scope, mock_get):
        mock_response = MagicMock()
        mock_response.json.return_value = {'token': 'fake_token'}
        mock_get.return_value = mock_response

        mock_session = MagicMock()
        mock_session_scope.return_value.__enter__.return_value = mock_session

        gq = GeoguessrQueries()
        gq.get_daily_challenge_token()

        mock_get.assert_called_with('https://www.geoguessr.com/api/v3/challenges/daily-challenges/today')
        mock_session.add.assert_called()
        mock_session.commit.assert_called()

    @patch('app.GeoguessrQueries.requests.Session')
    @patch('app.GeoguessrQueries.os.getenv')
    def test_sign_in(self, mock_getenv, mock_session):
        mock_getenv.side_effect = ['fake_username', 'fake_password']
        mock_response = MagicMock()
        mock_response.cookies.get.return_value = 'fake_ncfa_token'
        mock_response.status_code = 200

        with patch('app.GeoguessrQueries.requests.post', return_value=mock_response) as mock_post:
            gq = GeoguessrQueries()
            token = gq._sign_in()

            mock_post.assert_called_with(
                'https://www.geoguessr.com/api/v3/accounts/signin',
                json={'email': 'fake_username', 'password': 'fake_password'},
                headers={'Content-Type': 'application/json'}
            )
            self.assertEqual(token, 'fake_ncfa_token')

if __name__ == '__main__':
    unittest.main()