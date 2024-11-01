[![Python application](https://github.com/ldumaliang/GeoguessrDiscordBot/actions/workflows/python-app.yml/badge.svg)](https://github.com/ldumaliang/GeoguessrDiscordBot/actions/workflows/python-app.yml)

# GeoGuessr Daily Challenge Bot

This project is a Python-based tool that polls the Geoguessr Daily Challenge and posts the results to discord

## Getting Started

### Environment Variables

Update the system env variables
or
Create a file called `.env` with data for the following fields:

   - DISCORD_TOKEN
   - GUILD_ID
   - GEOGUESSR_USERNAME
   - GEOGUESSR_PASSWORD
   - NCFA_TOKEN

## Discord Bot

Required Permissions = 17998732324080

### Discord Bot Commands

#### Slash Commands (user facing)

1. **/register** - Registers a user with their Geoguessr name.
    - Usage: `.register 'Geoguessr Name'`


#### Dot Commands (for admins)

1. **sync_commands** - Syncs the bot commands with the guild
   - Usage: `.sync_commands`
2. **clear_commands** - Clears the bot commands for the guild
   - Usage: `.clear_commands`
3. **update_daily** - Updates the daily challenge token
   - Usage: `.update_daily`
4. **update_friends** - Updates the friends list
   - Usage: `.update_friends`
5. **update_session** - Executes a new sign-in request and updates the stored session cookie
   - Usage: `.update_session`
6. **enable** - Marks the current channel as the active channel for thread creation
   - Usage: `.enable`
