const config = require("../../utils/config");
const Player = require("./components/player");
const Card = require("./components/card");
const Logger = require("../logger");

const FACES = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K"
];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];
const SUITS = ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"];
const PHASES = [
  "waiting",
  "shuffle/deal",
  "player phase",
  "banker phase",
  "ended"
];

function newDeck() {
  return new Array(52)
    .fill(0)
    .map((c, i) => new Card(SUITS[i % 4], FACES[i % 13]));
}

class Room {
  constructor(room, index, rank) {
    this.roomnumber = room;
    this.players = new Array(config.MAXPLAYERS).fill(undefined);
    this.bankerIndex = 0;
    this.turnIndex = 0;
    this.phaseIndex = 0;
    this.minimumbank =
      index >= config[rank].ROOMS_1 ? config[rank].BANK_2 : config[rank].BANK_1;
    this.bank = this.minimumbank;
    this.warning = -1;
    this.gamesPlayed = 0;
    this.deck = newDeck();
    this.shuffle();
    this.houseProfit = 0.0;
    this.bankerQueue = [];
  }

  enter(user, socket, io) {
    if (!this.checkPlayer(user.id)) {
      let seat = this.findSeat();
      this.players[seat] = new Player(socket.id, this.findSeat());
      this.bankerQueue.push(user.sid);
      if (this.players.length === 1) {
        this.players[0].banker = true;
      }
      socket.join(this.roomnumber);
    }
    Logger.respLog(
      "resp_room_enter",
      {
        retcode: 0,
        roomnumber: this.roomnumber
      },
      "success"
    );
    socket.emit("resp_room_enter", {
      retcode: 0,
      roomnumber: this.roomnumber
    });
    Logger.respLog("resp_ingame_state", this.filterRoom(), "success");
    io.to(this.roomnumber).emit("resp_ingame_state", this.filterRoom());
  }

  findSeat() {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] === undefined) return i;
    }
    return -1;
  }

  leave(user, socket, io) {
    if (this.checkPlayer(user.sid)) {
      user.room = undefined;
      this.bankerQueue.filter(b => b !== user.sid);
      this.players = this.players.map(p =>
        p ? (p.sid === user.sid ? undefined : p) : undefined
      );
      socket.leave(this.roomnumber);
      Logger.respLog(
        "resp_room_leave",
        {
          retcode: 0,
          roomnumber: this.roomnumber,
          sid: user.sid
        },
        "success"
      );
      socket.emit("resp_room_leave", {
        retcode: 0,
        roomnumber: this.roomnumber,
        sid: user.sid
      });
      Logger.respLog("resp_ingame_state", this.filterRoom(), "success");
      io.to(this.roomnumber).emit("resp_ingame_state", this.filterRoom());
    }
  }

  getUserList(socket) {
    let sids = [];
    this.players.forEach(p => (p ? sids.push(p.sid) : undefined));
    Logger.respLog("resp_ingame_userlist", sids, "success");
    socket.emit("resp_ingame_userlist", sids);
  }

  ready(user, socket, io) {
    if (this.checkPlayer(user.sid)) {
      this.players.forEach(p => {
        if (p && p.sid === user.sid) p.isReady = true;
      });

      Logger.respLog("resp_ingame_imready", { retcode: 0 }, "success");
      socket.emit("resp_ingame_imready", { retcode: 0 });
      Logger.respLog(
        "resp_room_update",
        this.filterRoom(),
        user.sid + " ready"
      );
      io.to(this.roomnumber).emit("resp_ingame_state", this.filterRoom());
      if (this.readyCheck()) {
        Logger.respLog(
          "srqst_ingame_gamestart",
          { ts: 1923808 },
          this.roomnumber + " - gamestart"
        );
        io.to(this.roomnumber).emit("srqst_ingame_gamestart", { ts: 1923808 });
      }
      return;
    }
    Logger.respLog(
      "resp_ingame_imready",
      { retcode: 1 },
      "player not found in room"
    );
    socket.emit("resp_ingame_imready", { retcode: 1 });
  }

  bet(data, user, socket, io) {
    if (this.checkPlayer()) {
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i] && this.players[i].sid === user.sid)
          this.players[i].bet = data.betAmount;
      }
      let players = this.players
        .filter(p => p)
        .map(p => {
          return { sid: p.sid, cards: p.cards };
        });
      Logger.log(
        "srqst_ingame_place_bet",
        {
          sid: user.sid,
          betAmount: data.betAmount,
          ts: 1321432,
          players
        },
        this.roomnumber + " - betupdate"
      );
      io.to(this.roomnumber).emit("srqst_ingame_place_bet", {
        sid: user.sid,
        betAmount: data.betAmount,
        ts: 1321432,
        players
      });
      if (this.actionCheck("bet")) {
      }
      return;
    }
  }

  actionCheck(action) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] && this.players[i][action] === -1) return false;
    }
    return true;
  }

  readyCheck() {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] && !this.players[i].isReady) return false;
    }
    return true;
  }

  checkPlayer(sid) {
    for (let i = 0; i < this.players.length; i++)
      if (this.players[i] && sid === this.players[i].sid) return true;
    return false;
  }

  filterLobby() {
    let cnt = 0;
    this.players.forEach(p => (p !== undefined ? cnt++ : (cnt += 0)));
    return {
      roomnumber: this.roomnumber,
      players: cnt,
      bank: this.minimumbank,
      status: PHASES[this.phaseIndex]
    };
  }

  filterRoom() {
    return {
      roomnumber: this.roomnumber,
      players: this.players.filter(p => p),
      bankerIndex: this.bankerIndex,
      turnIndex: this.turnIndex,
      phaseIndex: this.phaseIndex,
      minimumbank: this.minimumbank,
      bank: this.bank,
      status: this.status,
      warning: this.warning,
      deck: this.deck.length
    };
  }

  shuffle() {
    for (let i = 0; i < 1000; i++) {
      let s1 = Math.floor(Math.random() * 52);
      let s2 = Math.floor(Math.random() * 52);
      let temp = this.deck[s1];
      this.deck[s1] = this.deck[s2];
      this.deck[s2] = temp;
    }
  }
}

module.exports = Room;
