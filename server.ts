"use strict";

import { Namespace, Socket } from "socket.io";

// ? IN DEVELOP LOAD CONFIG >> MONGODB KEY
if (process.env.NODE_ENV !== "production") {
  require("dotenv/config");
}

// * IMPORTS
// ? EXPRESS
import express from "express";
const app = express();
import compression from "compression";
import cors from "cors";

// Express types
import { Request, Response } from "express";

// ? MONGOOSE
import mongoose from "mongoose";

// ? PASSPORT and SESSION
import passport from "passport";
import session from "cookie-session";

// ? SOCKET.IO + HTTP
import socketIO from "socket.io";
import http from "http";

// ? PASSPORT CONFIG
require("./config/passport")(passport);

// ? EXPRESS BODYPARSER
app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true })); // to support URL-encoded bodies
app.use(cors());

// ? EXPRESS SESSION
app.use(
  session({
    keys: [process.env.COOKIE_SECRET as string],
    expires: new Date(253402300000000),
  })
);

// ? PASSPORT MIDDLEWARE
app.use(passport.initialize());
app.use(passport.session());

// ? ROUTES
import { apiRouter } from "./routes/api";
import { indexRouter } from "./routes/index";
app.use("/api/", apiRouter);
app.use("/", indexRouter);

app.use(compression());

if (process.env.NODE_ENV === "production" || true) {
  //Static folder
  app.use(express.static(__dirname + "/public/"));

  // Handle SPA

  app.get(/.*/, (req: Request, res: Response) =>
    res.sendFile(__dirname + "/public/index.html")
  );
}

// ? MongoDB Constructor and URL parser deprecation warning fix
mongoose.set("useUnifiedTopology", true);
mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);

// ? DB connection
mongoose.connect(process.env.DB_CONNECTION as string);
const db = mongoose.connection;

db.on("error", (err: Error) => console.error(err));
db.once("open", () => console.log("Connected to Mongoose"));

const PORT = process.env.PORT || 3000;

const server = new http.Server(app);

// utils functions import
import genID from "./utils/genUniqueID";
import gamePlan from "./utils/genMatrix";

import {
  getUserElo,
  startGame,
  gameClick,
  playerDisconnected,
} from "./utils/socketUtilFuncs";

const io = socketIO(server);
server.listen(PORT);

const gameMode = {
  quick: {
    que: [],
    games: {},
  },
  private: {
    games: {},
  },
  ranked: {
    que: [],
    games: {},
  },
};

// ? Managing Socket.IO instances
let searchNsp: Namespace = io.of("/q/search");
let rankedSearchNsp: Namespace = io.of("/r/search");
let quickNsp: Namespace = io.of("/q/game");
let rankedNsp: Namespace = io.of("/r/game");
let privateGameNsp: Namespace = io.of("/p/game");
let waitingRoomNsp: Namespace = io.of("/waiting");

// Quick
searchNsp.on("connection", function(socket: Socket) {
  // FIXME why never?
  gameMode.quick.que.push(socket.id as never);
  if (gameMode.quick.que.length >= 2) {
    let roomID = genID(gameMode.quick.games, 7);
    gameMode.quick.games[roomID] = {
      players: [],
      nicks: {},
      first: null,
      round: 0,
      isTimed: true,
      intervalLink: null,
      times: [
        { timeLeft: 150, timeStamp: Date.now() },
        { timeLeft: 150, timeStamp: Date.now() },
      ],
      won: null,
      gamePlan: gamePlan(15),
    };

    searchNsp.to(gameMode.quick.que[0]).emit("gameCreated", roomID);
    searchNsp.to(gameMode.quick.que[1]).emit("gameCreated", roomID);

    gameMode.quick.que.splice(0, 2);
  }

  socket.on("disconnect", function() {
    if (gameMode.quick.que.includes(socket.id)) {
      let indexOfSocket = gameMode.quick.que.indexOf(socket.id);
      gameMode.quick.que.splice(indexOfSocket, 1);
    }
  });
});

quickNsp.on("connection", function(socket) {
  let games = gameMode.quick.games;
  socket.on("gameJoined", function(roomID, username) {
    startGame(games, roomID, username, quickNsp, socket);
  });

  socket.on("game click", function(roomID, xPos, yPos) {
    gameClick(games, roomID, xPos, yPos, false, quickNsp, socket);
  });

  socket.on("disconnect", function() {
    playerDisconnected(games, false, quickNsp, socket);
  });
});

// Private
waitingRoomNsp.on("connection", function(socket: Socket, username: string) {
  socket.on("createRoom", function(timeInMinutes) {
    let roomID = genID(gameMode.private.games, 4);

    const isTimed = timeInMinutes !== null;

    gameMode.private.games[roomID] = {
      players: [],
      nicks: {},
      first: null,
      round: 0,
      isTimed: isTimed,
      times: [
        { timeLeft: timeInMinutes * 60, timeStamp: Date.now() },
        { timeLeft: timeInMinutes * 60, timeStamp: Date.now() },
      ],
      won: null,
      gamePlan: gamePlan(15),
    };

    socket.join(roomID);
    socket.emit("roomGenerated", roomID);
  });
  socket.on("roomJoined", function(roomID) {
    if (gameMode.private.games.hasOwnProperty(roomID)) {
      socket.join(roomID);

      gameMode.private.games[roomID].won = false;
      waitingRoomNsp
        .to(roomID)
        .emit(
          "gameBegun",
          roomID,
          gameMode.private.games[roomID].times[0].timeLeft
        );
    } else {
      socket.emit("room invalid");
    }
  });
  socket.on("disconnect", function() {
    let existingRooms = Object.keys(gameMode.private.games);
    for (let room of existingRooms) {
      if (gameMode.private.games[room].players.includes(socket.id)) {
        if (gameMode.private.games[room].won === null)
          delete gameMode.private.games[room];
      }
    }
  });
});

privateGameNsp.on("connection", function(socket) {
  socket.on("gameJoined", function(roomID, username) {
    startGame(gameMode.private.games, roomID, username, privateGameNsp, socket);
  });

  socket.on("game click", function(roomID, xPos, yPos) {
    gameClick(
      gameMode.private.games,
      roomID,
      xPos,
      yPos,
      false,
      privateGameNsp,
      socket
    );
  });

  socket.on("disconnect", function() {
    playerDisconnected(gameMode.private.games, false, privateGameNsp, socket);
  });
});

// Ranked
rankedSearchNsp.on("connection", function(socket) {
  socket.on("beginSearch", function(username: string) {
    // Assign Elo
    getUserElo(username, (err: Error, elo: number) => {
      if (err) console.log(err);
      gameMode.ranked.que.push({ id: socket.id, elo, username });

      if (gameMode.ranked.que.length >= 2) {
        let roomID = genID(gameMode.ranked.games, 7);
        gameMode.ranked.games[roomID] = {
          players: [],
          nicks: {},
          elo: {
            [gameMode.ranked.que[0].username]: gameMode.ranked.que[0].elo,
            [gameMode.ranked.que[1].username]: gameMode.ranked.que[1].elo,
          },
          first: null,
          round: 0,
          intervalLink: null,
          isTimed: true,
          times: [
            { timeLeft: 150, timeStamp: Date.now() },
            { timeLeft: 150, timeStamp: Date.now() },
          ],
          won: null,
          gamePlan: gamePlan(15),
        };

        rankedSearchNsp
          .to(gameMode.ranked.que[0].id)
          .emit("gameCreated", roomID);
        rankedSearchNsp
          .to(gameMode.ranked.que[1].id)
          .emit("gameCreated", roomID);

        gameMode.ranked.que.splice(0, 2);
      }
    });
  });

  socket.on("disconnect", function() {
    for (let queMember of gameMode.ranked.que) {
      if (queMember.id === socket.id) {
        let indexOfSocket = gameMode.ranked.que.indexOf(queMember);
        gameMode.ranked.que.splice(indexOfSocket, 1);
      }
    }
  });
});
rankedNsp.on("connection", function(socket) {
  let games = gameMode.ranked.games;

  socket.on("gameJoined", function(roomID, username) {
    startGame(games, roomID, username, rankedNsp, socket);
  });

  socket.on("game click", function(roomID, xPos, yPos) {
    gameClick(games, roomID, xPos, yPos, true, rankedNsp, socket);
  });

  socket.on("disconnect", function() {
    playerDisconnected(games, true, rankedNsp, socket);
  });
});
