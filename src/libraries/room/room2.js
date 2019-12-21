// const config = require("../../utils/config");
// const Users = require("./../user");
// const Player = require("./components/player");
// const Card = require("./components/card");
// const Logger = require("../logger");

// const FACES = [
//   "A",
//   "2",
//   "3",
//   "4",
//   "5",
//   "6",
//   "7",
//   "8",
//   "9",
//   "10",
//   "J",
//   "Q",
//   "K"
// ];
// const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];
// const SUITS = ["SPADES", "HEARTS", "DIAMONDS", "CLUBS"];
// const PHASES = [
//   { phase: "waiting", anims: ["ready"] },
//   { phase: "initialize bank", anims: ["deposit"] },
//   { phase: "betting", anims: ["bet"] },
//   { phase: "shuffle/deal", anims: ["deal"] },
//   { phase: "player phase", anims: ["draw", "pass"] },
//   { phase: "three card", anims: ["reveal"] },
//   { phase: "banker phase", anims: ["reveal", "draw", "pass"] },
//   { phase: "results", anims: ["confirm"] }
// ];
// const HIDDEN = { img: "hidden" };

// function newDeck() {
//   return new Array(52)
//     .fill(0)
//     .map((c, i) => new Card(SUITS[i % 4], FACES[i % 13]));
// }

// class Room {
//   constructor(room, index, rank) {
//     // lobby
//     this.roomnumber = room;
//     this.players = new Array(config.MAXPLAYERS).fill(undefined);
//     this.phaseIndex = 0;
//     this.minimumbank =
//       index >= config[rank].ROOMS_1 ? config[rank].BANK_2 : config[rank].BANK_1;

//     // room
//     this.bank = this.minimumbank;
//     this.bankerIndex = 0;
//     this.warning = -1;

//     // internal
//     this.revealed = [];
//     this.gamesPlayed = 0;
//     this.deck = newDeck();
//     this.houseProfit = 0.0;
//     this.bankerQueue = [];
//     this.nextPhase = this.initializeBank;
//   }

//   enter(user, socket, io) {
//     if (!this.checkPlayer(user.id)) {
//       let seat = this.findSeat();
//       this.players[seat] = new Player(socket.id, this.findSeat());
//       this.bankerQueue.push(user.sid);
//       if (this.players.length === 1) {
//         this.players[0].banker = true;
//       }
//       socket.join(this.roomnumber);
//     }
//     Logger.respLog(
//       "resp_room_enter",
//       {
//         retcode: 0,
//         roomnumber: this.roomnumber
//       },
//       "success"
//     );
//     socket.emit("resp_room_enter", {
//       retcode: 0,
//       roomnumber: this.roomnumber
//     });
//     Logger.respLog("resp_ingame_state", this.filterRoom(), "success");
//     io.to(this.roomnumber).emit("resp_ingame_state", this.filterRoom());
//   }

//   findSeat() {
//     for (let i = 0; i < this.players.length; i++) {
//       if (this.players[i] === undefined) return i;
//     }
//     return -1;
//   }

//   leave(user, socket, io) {
//     if (this.checkPlayer(user.sid)) {
//       user.room = undefined;
//       this.bankerQueue.filter(b => b !== user.sid);
//       this.players = this.players.map(p =>
//         p ? (p.sid === user.sid ? undefined : p) : undefined
//       );
//       socket.leave(this.roomnumber);
//       Logger.respLog(
//         "resp_room_leave",
//         {
//           retcode: 0,
//           roomnumber: this.roomnumber,
//           sid: user.sid
//         },
//         "success"
//       );
//       socket.emit("resp_room_leave", {
//         retcode: 0,
//         roomnumber: this.roomnumber,
//         sid: user.sid
//       });
//       Logger.respLog("resp_ingame_state", this.filterRoom(), "success");
//       io.to(this.roomnumber).emit("resp_ingame_state", this.filterRoom());
//     }
//   }

//   ready(user, socket, io) {
//     if (this.checkPlayer(user.sid)) {
//       this.players.forEach(p => {
//         if (p && p.sid === user.sid) p.isReady = true;
//       });
//       Logger.respLog(
//         "resp_ingame_imready",
//         { retcode: 0 },
//         user.sid + " - success"
//       );
//       socket.emit("resp_ingame_imready", { retcode: 0 });
//       this.piggyback(io);
//       if (this.check("isReady", false)) {
//         this.phaseIndex = 1;
//         Logger.respLog(
//           "srqst_ingame_gamestart",
//           { ts: new Date().getTime() },
//           this.roomnumber + " - gamestart"
//         );
//         io.to(this.roomnumber).emit("srqst_ingame_gamestart", {
//           ts: new Date().getTime()
//         });
//       }
//       return;
//     }
//     Logger.respLog(
//       "resp_ingame_imready",
//       { retcode: 1 },
//       "player not found in room"
//     );
//     socket.emit("resp_ingame_imready", { retcode: 1 });
//   }

//   initializeBank(io) {
//     for (let i = 0; i < this.players.length; i++) {
//       if (this.players[i] && this.players[i].sid === this.bankerIndex) {
//         this.bank += this.minimumbank;
//         this.players[i].balance -= this.minimumbank;
//         io.to("srqst_ingame_initial_bank", {
//           sid: this.players[i].sid
//         });
//       }
//     }
//   }

//   bet(data, user, io) {
//     if (this.phaseIndex !== 1 || this.bankerIndex === user.sid) return;
//     if (this.checkPlayer(user.sid)) {
//       for (let i = 0; i < this.players.length; i++) {
//         if (this.players[i] && this.players[i].sid === user.sid) {
//           if (this.players[i].bet !== 0) return;
//           this.players[i].bet = data.betAmount;
//           this.players[i].balance -= data.betAmount;
//           this.actions.push(this.players[i].sid);
//           Users.changeCash(user, -data.betAmount);
//           Logger.respLog(
//             "srqst_ingame_place_bet",
//             {
//               sid: user.sid,
//               betAmount: data.betAmount,
//               ts: new Date().getTime(),
//               players: this.piggybackPlayers()
//             },
//             this.roomnumber + " - betupdate"
//           );
//           io.to(this.roomnumber).emit("srqst_ingame_place_bet", {
//             sid: user.sid,
//             betAmount: data.betAmount,
//             ts: new Date().getTime(),
//             players: this.piggybackPlayers()
//           });
//           this.piggyback(io);
//           if (this.check("bet", 0)) {
//             this.shuffle(io);
//             this.phaseIndex++;
//             this.nextPhase(io);
//           }
//           return;
//         }
//       }
//     }
//   }

//   deal(io) {
//     this.players.forEach(p => {
//       if (p) {
//         p.cards.push(this.deck.pop());
//         p.cards.push(this.deck.pop());
//         let socket = Users.getUser(p.sid).socket;
//         io.to(socket).emit("srqst_ingame_deal", {
//           cards: [p.cards[0], p.cards[1]]
//         });
//       }
//     });
//     this.nextPhase = this.playerPhase;
//   }

//   playerAction(data, user, socket, io) {
//     if (data.action === "draw") {
//       this.players.forEach(p => {
//         if (p && user.sid === p.sid) {
//           let c = this.deck.pop();
//           p.cards.push(c);
//           socket.emit("srqst_ingame_player_action_update", {
//             sid: p.sid,
//             action: data.action,
//             cards: p.cards
//           });
//         }
//       });
//       io.to(this.roomnumber).emit("srqst_ingame_player_action_update", {
//         sid: user.sid,
//         action: "draw"
//       });
//       return;
//     }
//     socket.emit("srqst_ingame_player_action_update", {
//       sid: user.sid,
//       action: data.action
//     });
//     io.to(this.roomnumber).emit("srqst_ingame_player_action_update", {
//       sid: user.sid,
//       action: data.action
//     });
//   }

//   playerPhase(io) {
//     Logger.respLog(
//       "srqst_ingame_player_action",
//       {
//         ts: new Date().getTime()
//       },
//       this.roomnumber + " - player phase"
//     );
//     io.to(this.roomnumber).emit("srqst_ingame_player_action", {
//       ts: new Date().getTime()
//     });
//     this.piggyback(io);
//     this.nextPhase = this.bankerPhase;
//   }

//   confirm(anim, user, io) {
//     if (!PHASES[this.phaseIndex].anims.includes(anim)) return;
//     this.players.forEach(p => {
//       if (p && p.sid === user.sid) {
//         if (p.lastConfirmedAnimation === anim) return;
//         p.lastConfirmedAnimation = anim;
//       }
//     });
//     if (this.sync("lastConfirmedAnimation", anim)) {
//       this.nextPhase(io);
//       this.phaseIndex++;
//     }
//   }

//   check(prop, unchanged) {
//     for (let i = 0; i < this.players.length; i++) {
//       if (this.players[i] && this.players[i][prop] === unchanged) return false;
//     }
//     return true;
//   }

//   sync(prop, changed) {
//     for (let i = 0; i < this.players.length; i++) {
//       if (this.players[i] && this.players[i][prop] !== changed) return false;
//     }
//     return true;
//   }

//   piggyback(io, type, actions) {
//     // Logger.respLog(
//     //   "resp_ingame_state",
//     //   this.filterRoom(),
//     //   "piggback - " + PHASES[this.phaseIndex].phase
//     // );
//     io.to(this.roomnumber).emit("resp_ingame_state", this.filterRoom());
//   }

//   piggybackPlayers() {
//     return this.players.filter(p => p).map(p => this.filterPlayer(p));
//   }

//   checkPlayer(sid) {
//     for (let i = 0; i < this.players.length; i++)
//       if (this.players[i] && sid === this.players[i].sid) return true;
//     return false;
//   }

//   // filter

//   filterLobby() {
//     let cnt = 0;
//     this.players.forEach(p => (p !== undefined ? cnt++ : (cnt += 0)));
//     return {
//       roomnumber: this.roomnumber,
//       players: cnt,
//       bank: this.minimumbank,
//       status:
//         cnt === this.players.length ? "full" : PHASES[this.phaseIndex].phase
//     };
//   }

//   filterRoom() {
//     return {
//       roomnumber: this.roomnumber,
//       players: this.players
//         .filter(p => p)
//         .map(p => {
//           let player = {
//             ...p,
//             cards: this.hiddenCards(p)
//           };
//           delete player["lastConfirmedAnimation"];
//           return player;
//         }),
//       bankerIndex: this.bankerIndex,
//       turnIndex: this.turnIndex,
//       phaseIndex: this.phaseIndex,
//       minimumbank: this.minimumbank,
//       bank: this.bank,
//       status: this.status,
//       warning: this.warning,
//       deck: this.deck.length
//     };
//   }

//   filterPlayer(player) {
//     return {
//       sid: player.sid,
//       cards: this.hiddenCards(player)
//     };
//   }

//   hiddenCards(player) {
//     return this.revealed.includes(player.sid)
//       ? player.cards
//       : new Array(player.cards.length).fill(0).map(c => {
//           return { ...HIDDEN };
//         });
//   }

//   // misc.

//   getUserList(socket) {
//     let sids = [];
//     this.players.forEach(p => (p ? sids.push(p.sid) : undefined));
//     Logger.respLog("resp_ingame_userlist", sids, "success");
//     socket.emit("resp_ingame_userlist", sids);
//   }

//   shuffle(io) {
//     for (let i = 0; i < 1000; i++) {
//       let s1 = Math.floor(Math.random() * 52);
//       let s2 = Math.floor(Math.random() * 52);
//       let temp = this.deck[s1];
//       this.deck[s1] = this.deck[s2];
//       this.deck[s2] = temp;
//     }
//   }
// }

// module.exports = Room;