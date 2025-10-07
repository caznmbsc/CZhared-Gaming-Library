import subprocess
import site
import os
import sys
import json
import re
import requests
import urllib.parse
from bs4 import BeautifulSoup
import time
from playwright.sync_api import sync_playwright
from pathlib import Path

userBase = site.USER_BASE
scriptsFolder = ""

# Handle finding the appropriate python folder regardless of download method
if "Scripts" in os.listdir(userBase):
    print("Found Operating Folder...\n")
    scriptsFolder = os.path.join(userBase, "Scripts")
else:
    major = sys.version_info.major
    minor = sys.version_info.minor
    scriptsFolder = os.path.join(userBase, f"Python{major}{minor}", "Scripts")

# Install Playwright Browser if not installed
    print("Installing Playwright Browser if Missing...\n--------------------")
    playwrightInstall = subprocess.run([os.path.join(scriptsFolder, "playwright"), "install"], capture_output=True, text=True, check=True)
    print(f"{playwrightInstall.stdout}\n{playwrightInstall.stderr}\n")

# Login for Legendary Credentials
    input('Make sure you are focusing on an Incognito Browser.\nAnother CMD will open asking you to login.\nLogin and paste the code it asks for.\nAfter completing that you can close the windows and return here.\n(If no login is needed, it will say "Stored credentials are still valid").\nPress Enter When Ready...\n')
    proc = subprocess.Popen(
        f'start "" cmd /k "{os.path.join(scriptsFolder, "legendary")} auth --disable-webview"',
        shell=True
    )
    input("If you have SUCCESSFULLY Logged in, Press Enter...")
    
# Get the list of games in the account using Legendary
tempJson = subprocess.run([os.path.join(scriptsFolder, "legendary"), "list", "--json"], capture_output=True, text=True, check=True)
data = json.loads(tempJson.stdout)

# Get the previous game data record for comparison
dataFolder = Path.cwd().parent.joinpath("data")
with open(dataFolder.joinpath("epicLibrary.json"), "r", encoding="utf-8") as oldJson:
    games = json.load(oldJson)

# Iterate and parse through Legendary games and record data if missing
for game in data:
    print("Getting Game Data...")
    gameData = {}
    gameData["title"] = game["app_title"]
    print(gameData["title"])

    if f"{gameData["title"]} | [Epic]" in games.keys():
        print("Data Already Stored. Skipping\n")
        continue

    # Strip title for better title comparison
    strippedTitle = re.sub(r"[^a-zA-Z0-9]", "", gameData["title"])
    gameData["image"] = game["metadata"]["keyImages"][0]["url"]

    searchUrl = f"https://store.epicgames.com/en-US/browse?q={urllib.parse.quote(gameData["title"])}&sortBy=relevancy&sortDir=DESC&count=40"
    
    # Use Playwright to make a dummy webpage to scrape data
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(searchUrl)
        htmlText = page.content()
        browser.close()

    # Scrape HTML to find game store page
    searchPage = BeautifulSoup(htmlText, "html.parser")
    noLinkCheck = searchPage.find("span", string="No results found")
    if not noLinkCheck:
        gamePageLink = searchPage.find("img", {"alt": lambda alt: re.sub(r"[^a-zA-Z0-9]", "", alt).lower() == strippedTitle.lower()})
        if gamePageLink:
            gamePageLink = gamePageLink.find_parent("a")["href"]
            gameData["link"] = f"https://store.epicgames.com{gamePageLink}"
        else:
            gameData["link"] = None
    else:
        gameData["link"] = None

    # Set Platform
    gameData["platform"] = "Epic"

    # Append formed data to the parent dictionary
    games[f"{gameData["title"]} | [Epic]"] = gameData
    print(f"Game Recorded\n")

# Write all data to new JSON file
with open(dataFolder.joinpath("epicLibrary.json"), "w", encoding="utf-8") as sortedJSON:
    json.dump(games, sortedJSON, ensure_ascii=False, indent=4)

print("---------------------\nEpic JSON Created")