games = {}
async function loadGames(pageName) {
    try {
        //Read JSON
        const response = await fetch("data/fullLibrary.json");
        const json = await response.json();
        //Load All Game's Data from Premade JSON
        const keys = Object.keys(json).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        
        const gameCardTemplate = document.querySelector("[game-info-template]");
        const pageBody = document.querySelector("[page-body]");

        keys.forEach(key => {
            const gameCard = gameCardTemplate.content.cloneNode(true).children[0];
            const gameImage = gameCard.querySelector("[game-image]")
            const gameLink = gameCard.querySelector("[game-link]")
            const gamePlatform = gameCard.querySelector("[game-platform]")

            gameLink.textContent = key;
            gameLink.href = json[key]["link"];
            gamePlatform.textContent = json[key]["platform"];

            const loadingImage = new Image();
            gameImage.alt = key.replaceAll('"', "'");
            loadingImage.src = json[key]["image"];
            loadingImage.alt = key.replaceAll('"', "'");
            gameLink

            loadingImage.onload = () => {
                waitingImage = document.querySelector(`img[alt="${loadingImage.alt.replaceAll('"', "'")}"]`);
                if (loadingImage.src == null) {
                    console.log(loadingImage.alt);
                }
                waitingImage.src = loadingImage.src;

                //Garbage Collection
                loadingImage.onload = null;
            }

            pageBody.append(gameCard);
            games[key] = gameCard;
        });
    }
    catch(err) {
        console.log(err);
    }
}

const videos = [
    "media/RiskOfRain2.mp4", 
    "media/BatmanArkhamKnight.mp4", 
    "media/BlazBlueEntropyEffect.mp4", 
    "media/DevilMayCry5.mp4 media/DoomEternal.mp4", 
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
loadGames("test")

const searchInput = document.querySelector("[game-search]");
if (searchInput != null) {
    searchInput.addEventListener("input", (e) => {
        const value = e.target.value.toLowerCase();
        Object.entries(games).forEach(([key, card]) => {
            const isVisible = key.toLowerCase().includes(value);
            card.classList.toggle("hidden", !isVisible)
        })
    })
}

video1.addEventListener("ended", playRandomVideo);
video2.addEventListener("ended", playRandomVideo);