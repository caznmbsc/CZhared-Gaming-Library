from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import time
import json
import urllib.parse
import re
from pathlib import Path

steamSearchUrl = "https://store.steampowered.com/search/?term="

input("\nThis is going to open a browser and ask you to login.\nOnce you login DO NOT MOVE OR CLOSE THE BROWSER.\nONLY MINIMIZE THE BROWSER AND LET THE CMD RUN.\nWhen ready Pres Enter...")
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=False)
    page = browser.new_page()

    # Handle Login
    page.goto("https://store.steampowered.com/account/familymanagement?tab=manage")
    print("Please Login...")
    page.wait_for_url("https://store.steampowered.com/account/familymanagement?tab=manage", timeout=0)
    print("Login Complete...")

    # Open child shared library through button click
    czAccountDiv = page.locator("//div[contains(text(), 'Krackistan2422')]/ancestor::div[5]")
    czAccountButton = czAccountDiv.locator("xpath=.//button")
    czAccountButton.click()

    # Wait for games to load and grab the games div
    page.wait_for_load_state("networkidle")
    shareableGames = page.locator("div[style*='position: absolute'][style*='top: 0px'][style*='left: 0px'][style*='width: 100%']")
    
    # Prep variable to hold game data
    dataFolder = Path.cwd().parent.joinpath("data")
    with open(dataFolder.joinpath("steamLibrary.json"), "r", encoding="utf-8") as oldData:
        games = json.load(oldData)

    # Get the parent div responsible for scrolling
    gamesScroller = shareableGames.locator("..").locator("..").locator("..").locator("..")
    chainedFails = 0
    firstGame = None
    rowLoopAchieved = False
    
    while chainedFails < 20:
        shareableGames = page.locator("div[style*='position: absolute'][style*='top: 0px'][style*='left: 0px'][style*='width: 100%']")

        # Get all of the game row divs and wait for them to load
        page.wait_for_load_state("networkidle")
        shareableGameRows = shareableGames.locator(":scope > div")
        shareableGameRows.first.wait_for(state="visible")
        
        # Iterate
        tempGameList = []
        #print(f"Found: {shareableGameRows.count()}")
        for i in range(shareableGameRows.count()):
            print("Iterating row")
            row = shareableGameRows.nth(i).locator(":scope > div").nth(0)
            rowGames = row.locator(":scope > div")
            #print(f"Found: {rowGames.count()}")
            if rowGames.nth(0).locator("img").get_attribute("alt") != firstGame:
                print("\nGood Loop...")
                rowLoopAchieved = True
                chainedFails = 0
            else:
                if firstGame != None:
                    print("\nFailed Loop...")
                    rowLoopAchieved = False
                    chainedFails += 1
                    break
            for o in range(rowGames.count()):
                game = rowGames.nth(o)
                print(f"\t{game.locator("img").get_attribute("alt")}")
                gameData = {}
                tempGameList.append(game.locator("img").get_attribute("alt"))
                # Check for class that coincides with sharing (for now...)
                if "_2JNwI2OBNP8taZ7Z34Tulo" in game.get_attribute("class"):
                    gameData["title"] = game.locator("img").get_attribute("alt")
                    strippedTitle = re.sub(r"[^a-zA-Z0-9]", "", gameData["title"]).lower()
                    # If the entry exists in the previous data then skip it
                    if f"{gameData["title"]} | [Steam]" in games.keys(): 
                        print("\tDupe Skipping...")
                        continue
                    gameData["image"] = game.locator("img").get_attribute("src")
                    gameData["link"] = None

                    # Make a new tab to search for the game link
                    searchPage = browser.new_page()
                    searchPage.goto(f"{steamSearchUrl}{urllib.parse.quote(gameData["title"])}")
                    searchRows = searchPage.locator("#search_resultsRows")
                    searchGames = searchRows.locator(":scope > a")
                    for p in range(searchGames.count()):
                        searchGameName = searchGames.nth(p).locator(":scope > div").nth(1).locator(":scope > div").nth(0).locator(":scope > span").nth(0).text_content()
                        searchGameName = re.sub(r"[^a-zA-Z0-9]", "", searchGameName).lower()
                        if searchGameName == strippedTitle:
                            gameData["link"] = searchGames.nth(p).get_attribute("href")
                            break
                    searchPage.close()

                    gameData["platform"] = "Steam"
                    games[f"{gameData["title"]} | [Steam]"] = gameData
                    print(f"\t\t{gameData["title"]} is SHARED")
        if rowLoopAchieved or firstGame == None:
            print("New Game Barrier...")
            firstGame = tempGameList[0]
        print()
        gamesScroller.evaluate("div => div.scrollTop += 100")
        time.sleep(0.1)
        #input("Ready to Scroll?..")
    
    browser.close()
with open(dataFolder.joinpath("steamLibrary.json"), "w", encoding="utf-8") as newJSON:
    json.dump(games, newJSON, ensure_ascii=False, indent=2)
print("---------------------\nSteam JSON Created")