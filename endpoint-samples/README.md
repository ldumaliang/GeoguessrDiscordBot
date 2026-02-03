Endpoint Samples

Sanitized response examples from GeoGuessr endpoints. Values are fake but the
shape matches the real responses to help guide parsing. These samples are used
by the `npm run simulate` test harness.

Endpoints
- GET https://www.geoguessr.com/api/v3/social/friends/summary
  -> friends.json
- GET https://www.geoguessr.com/api/v3/users/<userId>/stats
  -> user.json (use userId from friends or profile response)
- GET https://www.geoguessr.com/api/v3/profiles
  -> profile.json

- GET https://www.geoguessr.com/api/v3/results/highscores/<challengeToken>?friends=true
  -> results.json (detailed per-round friend results)

Notes
- IDs, names, tokens, and timestamps are placeholders.
- Arrays are trimmed for readability; field names and nesting are preserved.
