const { count } = require("console");

/**
 * @param {import("./types").PluginProps} props
 */
module.exports = ({ logger, config, battlefield, store }) => {
  /** @type {import("vu-rcon").Battlefield.MapEntry[]} */
  let maps = [];
  /**
   * @type any
   */
  let countList = {};
  let votedPlayers = [];
  let selectedMaps = [];
  let votesActive = false;
  let votesStoped = false;
  let endOfRound = false;
  /**
   * @type any
   */
  let overviewIntervall = undefined;
  let yellIntervall = undefined;
  checkIfEndNear();
  let checkIntervall = setInterval(checkIfEndNear, 10000);

  battlefield.on("roundOver",async (ev) => {
    if (endOfRound === false) {
      endOfRound = true;
      let { index, max } = calcWinner();
      if (parseInt(index) > -1 && max > 0) {
        logger.info("new map: " + parseInt(index));
        battlefield.setNextMapIndex(index);
      }else{
        console.warn("No map voted")
        console.warn(index,max)
        console.warn("................")
      }
      votesActive = false;
      votesStoped = false;
      countList = {};
      votedPlayers = [];
      selectedMaps = [];
      maps = [];
      clearInterval(overviewIntervall);
      clearInterval(yellIntervall);
    } else {
      endOfRound = false;
    }
  });
  battlefield.on("levelLoaded", (ev) => {
    console.log("Level loaded");
    endOfRound = false;
    votesActive = false;
    votesStoped = false;
    countList = {};
    votedPlayers = [];
    selectedMaps = [];
    maps = [];
    clearInterval(overviewIntervall);
    clearInterval(yellIntervall);
  });

  function checkIfPlayerVoted(sPlayer) {
    return votedPlayers.indexOf(sPlayer) != -1;
  }
  async function yellMapsToAll() {
    let str = await getMapsString();
    battlefield.yell(str, 10, ["all"]);
  }

  async function getMapsString() {
    if (maps.length === 0 || selectedMaps === 0) {
      await loadMaps();
    }
    let str = "";
    selectedMaps.forEach((element) => {
      if (countList[element.index + ""] == undefined) {
        countList[element.index + ""] = 0;
      }
      str +=
        mapNameToReadableName(element.map) +
        ": " +
        element.index +
        " [" +
        countList[element.index] +
        "], ";
    });
    return str;
  }

  battlefield.on("chat", async (ev) => {
    if (ev.msg.indexOf("!votedeveloper") !== -1) {
      battlefield.say("Developed by Maxinger15", 6, ["player", ev.player]);
      return;
    }

    if (ev.player.toLowerCase() !== "server") {
      if (ev.msg.indexOf("!maps") !== -1) {
        let str = await getMapsString();
        battlefield.yell(str, 15, ["player", ev.player]);
        return;
      }
      if (checkIfPlayerVoted(ev.player)) {
        logger.info("player " + ev.player + " already voted");
        return;
      }

      if (votesActive === true && votesStoped === false) {
        if (ev.msg.indexOf("!") !== -1) {
          let number = ev.msg.split("!")[1];
          if (number != undefined && !isNaN(number)) {
            if (countList[number] != undefined) {
              let index = parseInt(number);
              countList[index] = countList[index] + 1;
              votedPlayers.push(ev.player);
              battlefield.say("Vote received", ["player", ev.player]);
              logger.info("vote received for " + index);
            } else {
              battlefield.say("Wrong map number entered", [
                "player",
                ev.player,
              ]);
            }
          } else {
            //logger.warn("No number detected: " + ev.msg.split(" ")[1]);
          }
        }
      }
    }
  });

  async function loadMaps() {
    let offset = 0;
    maps = [];
    let map = await battlefield.getMaps();
    maps.push(...map);
    do {
      offset += 100;
      map = await battlefield.getMaps(offset);
      if (map.length > 0) {
        maps.push(...map);
      }
    } while (map.length > 0);
    selectedMaps = [];
    if (maps.length <= 6) {
      selectedMaps = maps;
    } else {
      maps.sort(() => Math.random() - 0.5);
      for (let i = 0; i < 6; i++) {
        selectedMaps.push(maps[i]);
      }
    }
  }
  function get2In1String(map1, map2) {
    let str = "";
    str +=
      mapNameToReadableName(map1.map) +
      ": " +
      map1.index +
      " [" +
      countList[map1.index] +
      "]";
    if (map2 != undefined) {
      str += " | ";
      str +=
        mapNameToReadableName(map2.map) +
        ": " +
        map2.index +
        " [" +
        countList[map2.index] +
        "]";
    }

    return str;
  }

  async function showOverview() {
    if (maps.length === 0 || selectedMaps === 0) {
      await loadMaps();
    }

    selectedMaps.forEach((element) => {
      if (countList[element.index + ""] == undefined) {
        countList[element.index + ""] = 0;
      }
    });
    battlefield.say("Vote the next map with !<number>", ["all"]);
    let i = 0;
    do {
      battlefield.say(get2In1String(selectedMaps[i], selectedMaps[i + 1]), [
        "all",
      ]);
      i = i + 2;
    } while (i < selectedMaps.length);
  }

  function calcWinner() {
    let max = -1;
    let index = "";
    Object.entries(countList).forEach((el) => {
      if (el[1] > max) {
        max = el[1];
        index = el[0];
      }
    });
    return { index, max };
  }

  async function checkIfEndNear() {
    let info = await battlefield.serverInfo();
    if (!votesActive && !votesStoped) {
      let soonEnding = false;
      info.scores.forEach((el) => {
        if (el <= config.ticketCount) {
          soonEnding = true;
        }
      });
      if (soonEnding && votesActive === false) {
        votesActive = true;
        overviewIntervall = setInterval(showOverview, config.overviewDelay);
        yellIntervall = setInterval(yellMapsToAll, config.yellDelay);
        battlefield.yell(
          "Mapvote started. Vote with !<number>. Get list with !maps",
          10,
          ["all"]
        );
        showOverview();
      }
    }
    if (votesActive && !endOfRound) {
      let stopVotes = false;
      info.scores.forEach((el) => {
        if (el <= 30 && votesActive) {
          stopVotes = true;
        }
      });
      if (stopVotes) {
        votesActive = false;
        votesStoped = true;
        clearInterval(overviewIntervall);
        clearInterval(yellIntervall);
        let { index,max } = calcWinner();
        let mapName = null;
        selectedMaps.forEach((el) => {
          if (el.index+"" === index+"" && max > 0) {
            mapName = el.map;
          }
        });
        console.log("winner", mapName);
        if (mapName !== null) {
          battlefield.yell("Next map is " + mapNameToReadableName(mapName), 6, [
            "all",
          ]);
        }
        return;
      }
    }
  }

  function mapNameToReadableName(name) {
    switch (name) {
      case "MP_001":
        return "Grand Bazaar";
      case "MP_003":
        return "Teheran Highway";
      case "MP_007":
        return "Caspian Border";
      case "MP_011":
        return "Seine Crossing";
      case "MP_012":
        return "Firestorm";
      case "MP_013":
        return "Damavand Peak";
      case "MP_017":
        return "Noshar Canals";
      case "MP_018":
        return "Kharg Island";
      case "MP_Subway":
        return "Operation Metro";

      case "XP1_001":
        return "Strike at Karkand";
      case "XP1_002":
        return "Gulf Of Oman";
      case "XP1_003":
        return "Sharqi Penisula";
      case "XP1_004":
        return "Wake Island";

      case "XP2_Factory":
        return "Scrabmetal";
      case "XP2_Office":
        return "Operation 925";
      case "XP2_Palace":
        return "Donya Fortress";
      case "XP2_Skybar":
        return "Ziba Tower";

      case "XP3_Desert":
        return "Bandar Desert";
      case "XP3_Alborz":
        return "Alborz Mountains";
      case "XP3_Shield":
        return "Armored Shield";
      case "XP3_Valley":
        return "Death Valley";

      case "XP4_FD":
        return "Markaz Monolith";
      case "XP4_Parl":
        return "Azadi Palace";
      case "XP4_Quake":
        return "Epicenter";
      case "XP4_Rubble":
        return "Talah Market";

      case "XP5_001":
        return "Riverside";
      case "XP5_002":
        return "Nebandan Flats";
      case "XP5_003":
        return "Kisar Railroad";
      case "XP5_004":
        return "Sabalan Pipeline";
      default:
        return name;
    }
  }
};
