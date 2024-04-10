[![Python application](https://github.com/ldumaliang/GeoguessrDiscordBot/actions/workflows/python-app.yml/badge.svg)](https://github.com/ldumaliang/GeoguessrDiscordBot/actions/workflows/python-app.yml)

# GeoGuessr Daily Challenge Bot

This project is a Python-based tool that polls the Geoguessr Daily Challenge and posts the results to discord

## Getting Started

To get a local copy up and running, you'll need to clone the repository and install the required Python packages.

### Prerequisites

Python 3.9

#### Python Packages Required

* requests
* sqlite3
* configparser

### Credential Configuration

Create a file called `credentials.ini` with data in the following format:

    [CREDENTIALS]
    Username: 'your username' 
    Password: 'your password'

### .env

Create a file called `.env` with data in the following format:

    DISCORD_TOKEN='your discord bot token'
    GUILD_ID='your guild id'

## Discord Bot

Required Permissions = 17998732324080
