import json
from pathlib import Path

fullData = {}
libraryList = []

dataFolder = Path.cwd().parent.joinpath("data")
with open(dataFolder.joinpath("steamLibrary.json"), "r", encoding="utf-8") as oldData:
    libraryList.append(json.load(oldData))
with open(dataFolder.joinpath("epicLibrary.json"), "r", encoding="utf-8") as oldData:
    libraryList.append(json.load(oldData))

for library in libraryList:
    fullData = fullData | library

with open(dataFolder.joinpath("fullLibrary.json"), "w", encoding="utf-8") as newJson:
    json.dump(fullData, newJson, ensure_ascii=False, indent=2)

print("---------------------\nFull Library JSON Created")