databaseURL = "https://erbmfmayovfxbutxsoax.supabase.co/functions/v1/"
cacheVersion = 1
var currentPage = window.location.href.split("/").pop() || "index.html";
if (currentPage == "") { currentPage = "index.html" }
clientUsername = ""
games = {}
searchedGames = {}
wishlistGames = {}
searchedValue = ""
visibleWishlist = {}
visibleCards = {}
lastSearch = ""
czharedIndex = -100;
wishlistIndex = -100;
shopIndex = -100;
bottomNavButtons = null

//TODO Might want to revisit singletons and improve. I don't think there are bugs, but there may be.

//Helper function for Promises
//Get all items from Object Store
async function promiser(transactionObjectStore) {
    return new Promise((resolve, reject) => {
        const request = transactionObjectStore.getAll()

        request.onsuccess = () => {
            resolve(request)
        }

        request.onerror = () => {
            reject(request.error)
        }
    })
}

//Create database
async function setupCache() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("czharedCacheDB", cacheVersion)

        //When version is changed or database is new
        request.onupgradeneeded = (event) => {
            console.log("Creating Cache Database or Upgrading Schema.");
            const database = event.target.result;
            if (!database.objectStoreNames.contains("czharedGames")) {
                database.createObjectStore("czharedGames", {
                    keyPath: "key"
                });
            }
        }

        //When database exists and is fetchable
        request.onsuccess = () => {
            console.log("Cache Database Exists. No upgrades needed.")
            resolve(request.result);
        }
        
        //When database fetch errors
        request.onerror = () => {
            console.log(`Cache Fetch Failed.`);
            reject(request.error)
        }
    })
    
}

//Update Database
async function updateCache(endpointURL, objectStore, username=null) {
    try {
        //Set up JSON input
        postBody = null;
        if (username != null) {
            postBody = {"username": username}
        }
        //Make a post request to the specific endpoint for the response
        console.log("Starting POST request...")
        const response = await fetch(`${databaseURL}${endpointURL}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(postBody)
        });
        if (!response.ok) {
            throw new Error(response.status);
        }
        responseJSON = await response.json();
        
        return new Promise((resolve, reject) => {
            console.log(`\t${responseJSON.message}`);
            
            const request = indexedDB.open("czharedCacheDB", cacheVersion)
            
            //When database exists and is fetchable
            request.onsuccess = async () => {
                console.log("Prepping Cache Write...");
                const database = request.result;
                const transaction = database.transaction(objectStore, "readwrite");
                const chosenTable = transaction.objectStore(objectStore);
                responseJSON.gameData.forEach((game) => {
                    switch(objectStore) {
                        case "czharedGames":
                            chosenTable.put({
                                key:`[${game.name}][${game.id}][${game.platform}]`,
                                id: game.id,
                                name: game.name, 
                                platform: game.platform, 
                                cover: game.cover, 
                                url: game.url,
                                new: game.new 
                            })
                            break;
                    }
                    
                })
                console.log("\tCache Write Completed.")
                var tableContents = await promiser(chosenTable)
                tableContents = tableContents.result
                resolve(tableContents)
            }

            //When database fetch errors
            request.onerror = () => {
                console.log(`Cache Write Failed.`);
                reject(request.error);
            } 
        })
    } catch(err) {
        console.log(`Database Fetch Failed: ${err}`)
    }
}

async function fetchCache(table) {

    return new Promise((resolve, reject) => {
        const request = indexedDB.open("czharedCacheDB", cacheVersion)
        
        //Database is fetchable. Fetch parameter's table
        request.onsuccess = async () => {
            console.log("Fetching Cache Data...");
            const database = request.result;
            const transaction = database.transaction(table, "readonly");
            const fetchedTable = transaction.objectStore(table);
            var fetchedData = await promiser(fetchedTable);
            fetchedData = fetchedData.result
            console.log("\tCache Fetch Completed.")
            resolve(fetchedData) 
        }
        
        //Database fetch failed.
        request.onerror = () => {
            console.log(`Cache Fetch Failed.`);
            reject(request.error)
        }
    })
}

async function loadGameData(gamesArray, staleRunFlag=false) {
    console.log("Loading Game Data...")
    try {
        //Sort All Games by Name and Newness
        gamesArray.sort((a, b) => {
            //Push new games to the top
            if (b.new != a.new) return b.new - a.new;

            //Sort alphabetically
            return a.name.localeCompare(b.name);
        });
        
        //Delete all old game data so we can input the new data
        games = {}

        gamesArray.forEach(game => {
            games[`[${game.name}][${game.id}][${game.platform}]`] = game
        });

        console.log("\tDone Loading Game Data.")
        if (currentPage == "index.html") {
            loadCards(proceeding=true, bottomNav=true, staleRun=staleRunFlag);
        } else {
            loadCards();
        }
    }
    catch(err) {
        console.log("\tLoading Game Data FAILED.")
        console.log(`\t${err}`);
        console.log("\tDone Loading Game Data.")
    }
}

var loadCardsRunning = false
async function loadCards(proceeding=true, bottomNav=false, staleRun=false, gamesDictionary=games, wishlistLoad=false) {
    if (loadCardsRunning == true) {
        console.log("\tLoad Cards is already running. Call Terminated.")
        return;
    } else {
        loadCardsRunning = true
    }

    try {
        console.log("Loading Cards...")

        //0 Can mean no searchValue or no search results
        if (!wishlistLoad) {
            if (Object.keys(searchedGames).length > 0) {
                gamesDictionary = searchedGames
            } else if (searchedValue != "") {
                gamesDictionary = searchedGames
            }

            //Set up the starting index for each page and use case
            start = 0;
            if (!staleRun) {
                switch (currentPage){
                    case "index.html":
                        start = czharedIndex - 100 + (200 * proceeding)
                        break;
                    case "wishlist.html":
                        start = shopIndex - 100 + (200 * proceeding)
                        break;
                }   
            } else {
                console.log("\tSTALERUN")
            }
        } else {
            start = 0
        }
        
        console.log(`\tINTENDED START AT INDEX ${start}`)

        keysToRender = Object.keys(gamesDictionary).slice(start, start + 100)

        const gameCardTemplate = document.querySelector("[game-info-template]");
        const pageBody = document.querySelector("[page-body]");
        const wishlistCardTemplate = document.querySelector("[wishlist-game-template]");
        const myWishlist = document.querySelector("[my-wishlist]");
        const wishlistShop = document.querySelector("[wishlist-shop]")
        
        // console.log(gamesDictionary)
        if (keysToRender.length > 0) {
            if (wishlistLoad) {
                //Delete all old gameCards so we can input the new gameCards
                for (const gameKey in visibleWishlist) {
                    //console.log(`REMOVING: ${gameKey}`)
                    visibleWishlist[gameKey].remove();
                }

                keysToRender.forEach(key => {
                    const wishlistCard = wishlistCardTemplate.content.cloneNode(true).children[0];
                    const wishlistGameImage = wishlistCard.querySelector("[wishlist-game-image]")
                    const wishlistGamePlatformStamp = wishlistCard.querySelector("[wishlist-game-platform]")
                    if (gamesDictionary[key].cover != "" && gamesDictionary[key].cover != null) {
                        wishlistGameImage.src = gamesDictionary[key].cover;
                    } else {
                        //console.log(`${key}: HAS NO IMAGE`)
                    }
                    wishlistGameImage.alt = key;
                    switch (gamesDictionary[key].platform) {
                        case "PC (Microsoft Windows)":
                            wishlistGamePlatformStamp.src = "media/PCLogo.png"
                            break;
                        case "PlayStation 4":
                            wishlistGamePlatformStamp.src = "media/PS4Logo.png"
                            break;
                        case "Oculus VR":
                            wishlistGamePlatformStamp.src = "media/VRLogo.png"
                            break;
                        case "SteamVR":
                            wishlistGamePlatformStamp.src = "media/VRLogo.png"
                            break;
                    }
                    wishlistCard.classList.toggle("wishlisted");
                    visibleWishlist[key] = wishlistCard;
                    myWishlist.append(wishlistCard);
                })
                loadCardsRunning = false
                storeSearchRunning = false
                wishlistGameRunning = false
                return
            }
            //Delete all old gameCards so we can input the new gameCards
            for (const gameKey in visibleCards) {
                //console.log(`REMOVING: ${gameKey}`)
                visibleCards[gameKey].remove();
            }
            if (!staleRun) {
                czharedIndex = start
                shopIndex = start
            }  

            keysToRender.forEach(key => {
                if (currentPage == "index.html") {
                    const gameCard = gameCardTemplate.content.cloneNode(true).children[0];
                    const gameImage = gameCard.querySelector("[game-image]")
                    const gameLink = gameCard.querySelector("[game-link]")
                    const gamePlatform = gameCard.querySelector("[game-platform]")
                    const gameStamp = gameCard.querySelector("[game-stamp]")

                    gameLink.textContent = gamesDictionary[key].name;
                    gameLink.href = gamesDictionary[key].url;
                    gamePlatform.textContent = gamesDictionary[key].platform;
                    if ("new" in gamesDictionary[key]) {
                        if (gamesDictionary[key].new > 0) {
                            gameStamp.classList.toggle("hidden");
                        }
                    }

                    gameImage.alt = key.replaceAll('"', "'");
                    gameImage.src = gamesDictionary[key].cover;
                    
                    visibleCards[key] = gameCard;
                    pageBody.append(gameCard);
                } else {
                    const wishlistCard = wishlistCardTemplate.content.cloneNode(true).children[0];
                    const wishlistGameImage = wishlistCard.querySelector("[wishlist-game-image]")
                    const wishlistGamePlatformStamp = wishlistCard.querySelector("[wishlist-game-platform]")
                    if (gamesDictionary[key].cover != "" && gamesDictionary[key].cover != null) {
                        wishlistGameImage.src = gamesDictionary[key].cover;
                    } else {
                        //console.log(`${key}: HAS NO IMAGE`)
                    }
                    wishlistGameImage.alt = key;
                    switch (gamesDictionary[key].platform) {
                        case "PC (Microsoft Windows)":
                            wishlistGamePlatformStamp.src = "media/PCLogo.png"
                            break;
                        case "PlayStation 4":
                            wishlistGamePlatformStamp.src = "media/PS4Logo.png"
                            break;
                        case "Oculus VR":
                            wishlistGamePlatformStamp.src = "media/VRLogo.png"
                            break;
                        case "SteamVR":
                            wishlistGamePlatformStamp.src = "media/VRLogo.png"
                            break;
                    }
                    if (gamesDictionary[key].wishlisted) {
                        wishlistCard.classList.toggle("wishlisted");
                    }
                    visibleCards[key] = wishlistCard;
                    wishlistShop.append(wishlistCard);
                }
            });

            if (bottomNav) {
                if (bottomNavButtons != null) {
                    bottomNavButtons.remove()
                }
                const gamesNavTemplate = document.querySelector("[games-navigation]")
                const gamesNavButtons = gamesNavTemplate.content.cloneNode(true).children[0];
                pageBody.append(gamesNavButtons)
                bottomNavButtons = gamesNavButtons
            }
        } else if (Object.keys(gamesDictionary).length == 0) {
            //Delete all old gameCards so client knows there is nothing
            if (!wishlistLoad) {
                for (const gameKey in visibleCards) {
                    //console.log(`REMOVING: ${gameKey}`)
                    visibleCards[gameKey].remove();
                }  
            }
            
        }
        loadCardsRunning = false
        storeSearchRunning = false
        wishlistGameRunning = false
    }
    catch(err) {
        console.log("\tLoading Loading Game Cards FAILED.")
        console.log(`\t${err}`);
        loadCardsRunning = false
        storeSearchRunning = false
        wishlistGameRunning = false
    }
    console.log("\tDone Loading Game Cards.")
}

var showWishlistInfoRunning = false
function showWishlistInfo(gameButton) {
    if (showWishlistInfoRunning == true) {
        console.log("\tShow Wishlist Info is already running. Call Terminated.")
        return;
    } else {
        showWishlistInfoRunning = true
    }
    console.log("Loading Game Info...")
    key = gameButton.querySelector("[wishlist-game-image]").alt;
    overlay = document.querySelector("[wishlist-overlay]");
    overlay.classList.toggle("hidden");
    var infoDicitonary = {}
    var wishlisted = false

    if (key in games) {
        infoDicitonary = games
        wishlisted = infoDicitonary[key].wishlisted
    } else if (key in wishlistGames) {
        infoDicitonary = wishlistGames;
        wishlisted = true;
    }

    if (infoDicitonary[key].cover != "" && infoDicitonary[key].cover != null) {
        overlay.querySelector("[wish-cover]").src = infoDicitonary[key].cover;
    } else {
        overlay.querySelector("[wish-cover]").src = "media/noImage.png"
    }
    overlay.querySelector("[wish-cover]").alt = key;
    
    switch (infoDicitonary[key].platform) {
        case "PC (Microsoft Windows)":
            overlay.querySelector("[wish-platform-image]").src = "media/PCLogo.png"
            break;
        case "PlayStation 4":
            overlay.querySelector("[wish-platform-image]").src = "media/PS4Logo.png"
            break;
        case "Oculus VR":
            overlay.querySelector("[wish-platform-image]").src = "media/VRLogo.png"
            break;
        case "SteamVR":
            overlay.querySelector("[wish-platform-image]").src = "media/VRLogo.png"
            break;
    } 
    overlay.querySelector("[wish-name]").textContent = infoDicitonary[key].name
    overlay.querySelector("[wish-name]").href = infoDicitonary[key].url
    overlay.querySelector("[wish-platform]").textContent = infoDicitonary[key].platform
    overlay.querySelector("[wish-count]").textContent = `Total wishlists: ${infoDicitonary[key].wishlist_count}`
    wishlistButton = overlay.querySelector("[wishlist-button]");
    unwishlistButton = overlay.querySelector("[unwishlist-button]");
    if (wishlisted) {
        //Change Info Border for clarity
        if (!overlay.querySelector("[wish-card]").classList.contains("wishlisted")) {
            console.log("\tAdding Borders")
            overlay.querySelector("[wish-card]").classList.toggle("wishlisted")
        }

        //Remove Wishlist Button Functionality and Reset other Button
        if (wishlistButton) {
            if (wishlistButton.classList.contains("wishlist")) {
                wishlistButton.onclick = function() {}
                wishlistButton.classList.toggle("wishlist")
            }
            if (!wishlistButton.classList.contains("invalidWishlistButton")) {
                wishlistButton.classList.toggle("invalidWishlistButton")
            }
            if (!unwishlistButton.classList.contains("unwishlist")) {
                unwishlistButton.onclick = wishlistGame
                unwishlistButton.classList.toggle("unwishlist")
            }
            if (unwishlistButton.classList.contains("invalidWishlistButton")) {
                unwishlistButton.classList.toggle("invalidWishlistButton")
            }
        }
        
    } else {
        //Change Info Border for clarity
        if (overlay.querySelector("[wish-card]").classList.contains("wishlisted")) {
            console.log("\tDeleting Borders")
            overlay.querySelector("[wish-card]").classList.toggle("wishlisted")
        }
        
        //Remove Unwishlist Button Functionality and Reset other Button
        if (wishlistButton) {
            if (unwishlistButton.classList.contains("unwishlist")) {
                unwishlistButton.onclick = function() {}
                unwishlistButton.classList.toggle("unwishlist")
            }
            if (!unwishlistButton.classList.contains("invalidWishlistButton")) {
                unwishlistButton.classList.toggle("invalidWishlistButton")
            }
            if (!wishlistButton.classList.contains("wishlist")) {
                wishlistButton.onclick = wishlistGame
                wishlistButton.classList.toggle("wishlist")
            }
            if (wishlistButton.classList.contains("invalidWishlistButton")) {
                wishlistButton.classList.toggle("invalidWishlistButton")
            }
        }
        
    }
    console.log("\tGame Info Loaded.")
    showWishlistInfoRunning = false
}

function closeOverlay() {
    if (!document.querySelector("[wishlist-overlay]").classList.contains("hidden")) {
        document.querySelector("[wishlist-overlay]").classList.toggle("hidden");
    }    
}

var loginRunning = false
async function login() {
    if (loginRunning == true) {
        console.log("\tLogin is already running. Call Terminated.")
        return;
    } else {
        loginRunning = true
    }

    try {
        usernameValue = document.querySelector("[login-field]").value;
        userLoadingImage = document.querySelector("[user-loading]");
        userLoadingImage.classList.toggle("hidden");
        if (usernameValue != "" && usernameValue != null) {
            usernameValue = String(usernameValue)
            console.log("Starting POST request...")
            const response = await fetch(`${databaseURL}login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({"username": usernameValue})
            });
            responseJSON = await response.json()
            if (!response.ok) {
                userLoadingImage.classList.toggle("hidden");
                console.log(`\t${responseJSON.error}`)
                document.querySelector(["[login-message]"]).textContent = responseJSON.error
                loginRunning = false
                return;
            }
            userLoadingImage.classList.toggle("hidden");
            console.log(`\t${responseJSON.message}`)
            document.querySelector("[username-bulletin]").textContent = `${usernameValue}'s Wishlist`
            clientUsername = usernameValue;
            document.querySelector("[login-overlay]").remove()
            const wishlistSetup = getUserWishlist();
            wishlistSetup.then(() => {
                loadCards(true, false, false, wishlistGames, true)
            }) 
        } else {
            document.querySelector(["[login-message]"]).textContent = "Please enter a username."
            userLoadingImage.classList.toggle("hidden");
        }
        loginRunning = false
    } catch(err) {
        userLoadingImage.classList.toggle("hidden");
        console.error(`\t{err}`)
        loginRunning = false
    }
    
}
if (document.querySelector("[login-field]")) {
    document.querySelector("[login-field]").addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            login()
        }
    })
}

//TODO As it stands, only 100 wishlist items show. I dont really want to scale up though
var wishlistGameRunning = false
async function wishlistGame() {
    if (wishlistGameRunning == true) {
        console.log("\tWishlist Game is already running. Call Terminated.")
        return;
    } else {
        wishlistGameRunning = true
    }

    key = document.querySelector("[wish-cover]").alt
    var gameId = null
    var gamePlatform = null
    if (key in games) {
        gameId = games[key].id
        gamePlatform = games[key].platform
    } else if (key in wishlistGames) {
        gameId = wishlistGames[key].id
        gamePlatform = wishlistGames[key].platform
    }

    if (clientUsername == "" || clientUsername == null) {
        console.log("\tClient Username is Malformed. Exiting");
        wishlistGameRunning = false
        return
    } else if (gameId == null || gamePlatform == null) {
        console.log("\tGame Data is Malformed. Exiting");
        wishlistGameRunning = false
        return
    }

    try {
        console.log("Starting POST request...")
        const response = await fetch(`${databaseURL}wishlistGame`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({"username": clientUsername, "game_id": gameId, "game_platform": gamePlatform})
        });
        responseJSON = await response.json()
        if (!response.ok) {
            //userLoadingImage.classList.toggle("hidden");
            console.log(`\t${responseJSON.error}`)
            wishlistGameRunning = false
            return;
        }
        //userLoadingImage.classList.toggle("hidden");
        console.log(`\t${responseJSON.message}`)
        //If passed means its a removal | Else it is an addition
        if (key in wishlistGames) {
            console.log("\tGoing to Delete Game from Wishlist View.")
            wishlistGames[key].wishlist_count -= 1;
            currentWishlistCount = wishlistGames[key].wishlist_count;
            visibleWishlist[key].remove()
            delete wishlistGames[key]
            if (key in visibleCards) {
                console.log("\tGoing to Edit Game in Store View.")
                visibleCards[key].classList.toggle("wishlisted");
                games[key].wishlist_count = currentWishlistCount;
                games[key].wishlisted = false;
            }
            loadCards(true, false, false, wishlistGames, true)
            document.querySelector("[wishlist-overlay]").querySelector("[wish-count]").textContent = `Total wishlists: ${currentWishlistCount}`
            closeOverlay()
        } else {
            console.log("\tGoing to Add Game to Wishlist View.")
            currentWishlistCount = 0
            wishlistGames = Object.assign({}, {[key]: games[key]}, wishlistGames)
            wishlistGames[key].wishlist_count += 1;
            currentWishlistCount = wishlistGames[key].wishlist_count;
            if (key in visibleCards) {
                console.log("\tGoing to Edit Game in Store View.")
                visibleCards[key].classList.toggle("wishlisted");
                games[key].wishlist_count = currentWishlistCount;
                games[key].wishlisted = true;
            }
            loadCards(true, false, false, wishlistGames, true)
            document.querySelector("[wishlist-overlay]").querySelector("[wish-count]").textContent = `Total wishlists: ${currentWishlistCount}`
            closeOverlay()
        }
    } catch(err) {
        userLoadingImage.classList.toggle("hidden");
        console.error(`\t${err}`)
        wishlistGameRunning = false
    }
}

async function getUserWishlist() {
    try {
        console.log("Starting POST request...")
        const response = await fetch(`${databaseURL}getWishlist`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({"username": clientUsername})
        });
        responseJSON = await response.json()
        if (!response.ok) {
            //userLoadingImage.classList.toggle("hidden");
            console.log(`\t${responseJSON.error}`)
            return;
        }
        //userLoadingImage.classList.toggle("hidden");
        console.log(`\t${responseJSON.message}`)
        responseJSON.gameData.forEach(game => {
            wishlistGames[`[${game.wishlist_games["name"]}][${game.wishlist_games["id"]}][${game.wishlist_games["platform"]}]`] = game.wishlist_games
        });
    } catch(err) {
        userLoadingImage.classList.toggle("hidden");
        console.error(`\t${err}`)
    }

}

async function getGlobalWishlist() {
    try {
        console.log("Starting POST request...")
        const response = await fetch(`${databaseURL}getAllWishlists`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({})
        });
        responseJSON = await response.json()
        if (!response.ok) {
            //userLoadingImage.classList.toggle("hidden");
            console.log(`\t${responseJSON.error}`)
            return;
        }
        //userLoadingImage.classList.toggle("hidden");
        console.log(`\t${responseJSON.message}`)
        responseJSON.gameData.forEach(game => {
            wishlistGames[`[${game.name}][${game.id}][${game.platform}]`] = game
        });
    } catch(err) {
        userLoadingImage.classList.toggle("hidden");
        console.error(`\t${err}`)
    }

}

const videos = [
    "media/RiskOfRain2.mp4", 
    "media/BatmanArkhamKnight.mp4", 
    "media/BlazBlueEntropyEffect.mp4", 
    "media/DevilMayCry5.mp4",
    "media/DoomEternal.mp4", 
    "media/EldenRing.mp4", 
    "media/FinalFantasyXV.mp4", 
    "media/Left4Dead2.mp4", 
    "media/NeonWhite.mp4", 
    "media/Persona5Royal.mp4", 
    "media/Peak.mp4", 
    "media/ResidentEvil4.mp4", 
    "media/Repo.mp4",
    "media/SonicXShadowGenerations.mp4" ,
    "media/Tekken8.mp4", 
    "media/WestOfLoathing.mp4"
];

const video1 = document.querySelector("[video1]");
const video2 = document.querySelector("[video2]");
var randomVideo = ""

function playRandomVideo() {
    console.log("NEW VIDEO GETTING")
    var newVideo = false;
    while (!newVideo) {
        randomNumber = Math.floor(Math.random() * videos.length);
        if (videos[randomNumber] != randomVideo) {
            randomVideo = videos[randomNumber];
            newVideo = true;
        }
    }

    video1.src = randomVideo
    video2.src = randomVideo

    video1.load();
    video2.load();
    video1.play();
    video2.play();
}

playRandomVideo()
const setup = setupCache();
setup.then((setupResult) => {
    //console.log("CACHE SETUP DONE")
    var cacheTable = ""
    var cacheEndpoint = ""
    switch(currentPage) {
        case "index.html":
            cacheTable = "czharedGames";
            cacheEndpoint = "getCzharedGames";
            const intialCache = fetchCache(cacheTable);
                intialCache.then((cacheArray) => {
                    //console.log("WE HAVE INITIAL CACHE");
                    const updatedCachedData = updateCache(cacheEndpoint, cacheTable);
                    loadGameData(cacheArray, staleRun=true) 
                    updatedCachedData.then((newCacheArray) => {
                        //console.log("WE HAVE NEW CACHE");
                        console.log("Reloading Game Cards...");
                        const czharedGamesData = loadGameData(newCacheArray)
                        czharedGamesData.then(() => {
                            const globalWishlistSetup = getGlobalWishlist()
                            globalWishlistSetup.then(() => {
                                loadCards(true, false, false, wishlistGames, true)
                            }) 
                            //TODO WISHLIST LOAD AND CARD LOAD
                        })
                    })
                })
            break;
        default:
            return
    }
})

const searchInput = document.querySelector("[czhared-game-search]");
if (searchInput != null) {
    searchInput.addEventListener("input", (e) => {
        const value = e.target.value.toLowerCase().trim();
        searchedValue = value
        searchedGameKeys = Object.keys(games).filter(key => {
            return games[key].name.toLowerCase().includes(value);
        });
        console.log(`${searchedGameKeys.length} out of ${Object.keys(games).length}`)
        if (currentPage == "index.html") {
            czharedIndex = -100
            searchedGames = Object.fromEntries(
                Object.entries(games).filter(
                    ([key]) => searchedGameKeys.includes(key)
                )
            )
            loadCards(true, true, false, searchedGames)
        }
    })
}

var storeSearchRunning = false
async function storeSearch() {
    if (storeSearchRunning == true) {
        console.log("\tStore Search is already running. Call Terminated.")
        return;
    } else {
        storeSearchRunning = true
    }

    console.log("Searching Shop...")
    storeLoadingImage = document.querySelector("[store-loading]");
    searchValue = document.querySelector("[shop-game-search]").value.trim();
    console.log(`\tSearch for: ${searchValue}`)
    if (searchValue == null || searchValue == "") {
        console.log("\tNo search value detected.")
        storeSearchRunning = false
    } else if (searchValue.length < 3) {
        console.log("\tSearch Value is too short. Please enter at least 3 characters.")
        storeSearchRunning = false
    } else if (searchValue == lastSearch) {
        console.log("\tSearch has not changed.")
        storeSearchRunning = false
    } else {
        try {
            storeLoadingImage.classList.toggle("hidden");
            games = {}
            shopIndex = -100
            lastSearch = searchValue
            console.log("\tStarting POST request...")
            const response = await fetch(`${databaseURL}getWishableGames`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({"username": clientUsername, "searchValue": searchValue})
            });
            if (!response.ok) {
                throw new Error(response.status);
            }
            responseJSON = await response.json();
            responseJSON.gameData.forEach(game => {
                games[`[${game.name}][${game.id}][${game.platform}]`] = game
            });
            console.log("\tShop Search Completed")
            storeLoadingImage.classList.toggle("hidden");
            loadCards(true, false, false)
        } catch(err) {
            console.log("\tShop Search Failed.")
            console.log(err)
            storeSearchRunning = false
        }
    }
}

const wishlistSlider = document.querySelector('.wishlistBox');
const wishlistSearchSlider = document.querySelector('.searchedGames');

let isDown = false;
let startX;
let starty;
let scrollLeft;

if (wishlistSlider) {
    wishlistSlider.addEventListener('mousedown', (e) => {
    isDown = true;
    wishlistSlider.classList.add('active');
    startX = e.pageX - wishlistSlider.offsetLeft;
    scrollLeft = wishlistSlider.scrollLeft;
    });
    wishlistSlider.addEventListener('mouseleave', () => {
    isDown = false;
    wishlistSlider.classList.remove('active');
    });
    wishlistSlider.addEventListener('mouseup', () => {
    isDown = false;
    wishlistSlider.classList.remove('active');
    });
    wishlistSlider.addEventListener('mousemove', (e) => {
    if(!isDown) return;
    e.preventDefault();
    const x = e.pageX - wishlistSlider.offsetLeft;
    const walk = (x - startX) * 1; //Scroll Speed
    wishlistSlider.scrollLeft = scrollLeft - walk;
    //console.log(walk);
    });
}

if (wishlistSearchSlider) {
    wishlistSearchSlider.addEventListener('mousedown', (e) => {
    isDown = true;
    wishlistSearchSlider.classList.add('active');
    startY = e.pageY - wishlistSearchSlider.offsetTop;
    scrollTop = wishlistSearchSlider.scrollTop;
    });
    wishlistSearchSlider.addEventListener('mouseleave', () => {
    isDown = false;
    wishlistSearchSlider.classList.remove('active');
    });
    wishlistSearchSlider.addEventListener('mouseup', () => {
    isDown = false;
    wishlistSearchSlider.classList.remove('active');
    });
    wishlistSearchSlider.addEventListener('mousemove', (e) => {
    if(!isDown) return;
    e.preventDefault();
    const y = e.pageY - wishlistSearchSlider.offsetTop;
    const walk = (y - startY) * 1; //Scroll Speed
    wishlistSearchSlider.scrollTop = scrollTop - walk;
    //console.log(walk);
    });
}

video1.addEventListener("ended", playRandomVideo);
video2.addEventListener("ended", playRandomVideo);