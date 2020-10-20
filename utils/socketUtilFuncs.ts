import calibrateTime from "./calibrateTime";
import checkWin from "./checkWin";
import User from "../models/User";
import { Namespace, Socket } from "socket.io";
import { Game } from "../types/Game";

/**
 *
 * @param {Object} games existing games from certain gameType
 * @param {Boolean} rated does ELO need to be calculated
 * @param {Object} namespace socket.io namespace
 * @param {Object} socket socket.io instance
 */
function playerDisconnected(
  games: { [key: string]: Game },
  rated: boolean,
  namespace: Namespace,
  socket: Socket
): void {
  let existingRooms = Object.keys(games);
  for (let room of existingRooms) {
    if (games[room].players.includes(socket.id)) {
      if (games[room].won == null || games[room].won == false) {
        if (rated) {
          calcAndUpdateELO(games[room], "left", socket, (eloDiff: number) => {
            namespace.to(room).emit("playerLeft", eloDiff);
          });
        } else {
          namespace.to(room).emit("playerLeft");
        }
      }

      clearInterval(games[room].intervalLink as NodeJS.Timeout);
      delete games[room];
    }
  }
}

/**
 *
 * @param {Object} games existing games from certain gameType
 * @param {String} roomID
 * @param {Number} xPos
 * @param {Number} yPos
 * @param {Boolean} rated
 * @param {Object} namespace Socket.io namespace
 * @param {Object} socket Socket.io instance
 */
function gameClick(
  games: { [key: string]: Game },
  roomID: string,
  xPos: number,
  yPos: number,
  rated: boolean,
  namespace: Namespace,
  socket: Socket
) {
  const game = games[roomID];

  if (game) {
    const round = game.round + game.first;

    if (
      game.players[round % 2] === socket.id &&
      game.won === false &&
      game.gamePlan[xPos][yPos] === 0
    ) {
      clearInterval(game.intervalLink as NodeJS.Timeout);

      game.gamePlan[xPos][yPos] = round % 2 ? 1 : 2;

      namespace
        .to(roomID)
        .emit(
          "click success",
          socket.id,
          round,
          xPos,
          yPos,
          game.times,
          game.players
        );

      enum gameState {
        WIN = "win",
        TIE = "tie",
        CONTINUE = "continue",
      }

      const gameBoardState = checkWin(game.gamePlan, yPos, xPos, round);
      if (gameBoardState !== gameState.CONTINUE) {
        if (gameBoardState === gameState.WIN) {
          if (rated) {
            calcAndUpdateELO(game, gameState.WIN, socket, (eloDiff: number) => {
              namespace.to(roomID).emit(gameState.WIN, socket.id, eloDiff);
            });
          } else {
            namespace.to(roomID).emit(gameState.WIN, socket.id);
          }
        } else if (gameBoardState === gameState.TIE) {
          if (rated) {
            calcAndUpdateELO(
              game,
              gameState.TIE,
              socket,
              (eloDiff: number, tieGainerID: string) => {
                namespace.to(roomID).emit(gameState.TIE, eloDiff, tieGainerID);
              }
            );
          } else {
            namespace.to(roomID).emit(gameState.TIE);
          }
        }

        game.won = true;
      } else {
        if (game.isTimed) {
          game.times[Math.abs(round - 1) % 2].timeStamp = Date.now();
          game.intervalLink = setInterval(() => {
            if (game && game.won !== true) {
              let calibratedTime = calibrateTime(games, roomID, namespace);
              game.times[Math.abs(round - 1) % 2].timeLeft = calibratedTime;
              game.times[Math.abs(round - 1) % 2].timeStamp = Date.now();
            }
          }, 1000);
        }
      }

      game.round++;
    }
  }
}

/**
 * Calculates new ELO, callback emits to rooms with ELO diff, updatesELO in mongo
 * @param {Object} game
 * @param {String} gameEnding "win"|"tie"
 * @param {Object} socket socket.io instance
 * @param {Function} callback
 */
function calcAndUpdateELO(
  game: any,
  gameEnding: string,
  socket: Socket,
  callback: Function
): void {
  const id1 = Object.keys(game.nicks)[0];
  const id2 = Object.keys(game.nicks)[1];

  //  ELO RATING MATH

  const oldELO1 = game.elo[game.nicks[id1]];
  const oldELO2 = game.elo[game.nicks[id2]];

  const R1 = Math.pow(10, oldELO1 / 400);
  const R2 = Math.pow(10, oldELO2 / 400);

  const E1 = R1 / (R1 + R2);
  const E2 = R2 / (R1 + R2);

  // ELO K-factor, taken from chess
  const K = 32;

  let finalELO1, finalELO2;

  if (gameEnding === "win") {
    const S1 = socket.id === id1 ? 1 : 0;
    const S2 = socket.id === id2 ? 1 : 0;

    finalELO1 = Math.round(oldELO1 + K * (S1 - E1));
    finalELO2 = Math.round(oldELO2 + K * (S2 - E2));

    const eloDiff = Math.abs(oldELO1 - finalELO1);

    callback(eloDiff);
  } else if (gameEnding === "tie") {
    const S1 = 0.5;
    const S2 = 0.5;

    finalELO1 = oldELO1 + K * (S1 - E1);
    finalELO2 = oldELO2 + K * (S2 - E2);

    const eloDiff = Math.abs(oldELO1 - finalELO1);
    const tieGainerID = oldELO1 < finalELO1 ? id1 : id2;

    callback(eloDiff, tieGainerID);
  } else if (gameEnding === "left") {
    const S1 = socket.id === id1 ? 0 : 1;
    const S2 = socket.id === id2 ? 0 : 1;

    finalELO1 = Math.round(oldELO1 + K * (S1 - E1));
    finalELO2 = Math.round(oldELO2 + K * (S2 - E2));

    const eloDiff = Math.abs(oldELO1 - finalELO1);

    callback(eloDiff);
  }

  updateElo(game.nicks[id1], finalELO1);
  updateElo(game.nicks[id2], finalELO2);
}

/**
 * Finds game created in search (if not then send 404), picks random first player and sets time interval
 * @param {Object} games existing games from certain gameType
 * @param {String} roomID
 * @param {String} username
 * @param {Namespace} namespace socket.io namespace (e.g rankedNsp, quickNsp)
 * @param {Socket} socket socket.io instance
 */
function startGame(
  games: any,
  roomID: string,
  username: string,
  namespace: Namespace,
  socket: Socket
): void {
  // Check if room exists, otherwise send to 404
  if (!games.hasOwnProperty(roomID)) {
    socket.emit("roomMissing");
  } else {
    let game = games[roomID];
    if (game.players.length < 2) {
      socket.join(roomID);
      game.players.push(socket.id);
      game.nicks[socket.id] = username;
    }

    if (game.players.length === 2) {
      // taking random number representing player (0/1)
      let rndN = Math.round(Math.random());
      game.first = rndN;
      namespace
        .to(roomID)
        .emit("gameBegun", game.players[rndN], game.nicks, game.first);
      if (game.isTimed) {
        game.times[rndN].timeStamp = Date.now();
        game.intervalLink = setInterval(() => {
          if (game) {
            if (game.won !== true) {
              let calibratedTime = calibrateTime(games, roomID, namespace);
              game.times[rndN].timeLeft = calibratedTime;
              game.times[rndN].timeStamp = Date.now();
            }
          }
        }, 1000);
      }

      setTimeout(() => {
        if (games[roomID]) {
          games[roomID].won = false;
        }
      }, 3000);
    }
  }
}

/**
 *
 * @param {String} username
 * @param {Number} newElo
 * @return {Boolean} true\false
 */
// TODO Move to promise based function
function updateElo(username: string, newElo: number): void {
  User.findOneAndUpdate({ username }, { elo: newElo })
    .then(() => {})
    .catch((err) => {
      console.log(err);
    });
}

/**
 *
 * @param {String} username
 * @param {Function} callback
 * @return {Number} Elo
 */
// TODO Move to promise based functoin
// TODO Mongoose user type Document <= any
function getUserElo(username: string, callback: Function) {
  User.findOne({ username: username }).then((user: any) => {
    if (user) {
      callback(null, user.elo);
    } else {
      const err = new Error("User does not exist");
      callback(err, null);
    }
  });
}

export {
  getUserElo,
  updateElo,
  startGame,
  calcAndUpdateELO,
  gameClick,
  playerDisconnected,
};
