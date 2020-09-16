"use strict";
import mongoose from "mongoose";

enum gameBoard {
  NORMAL = "normal",
  TRADITIONAL = "traditional",
  MODERN = "modern",
}

export interface game {
  timestamp: Date;
  currElo: number;
}

export interface colors {
  enemeyColor: string;
  playerColor: string;
}

export interface IUser extends mongoose.Document {
  id: string;
  username: string;
  googleId?: string;
  password: string;
  email?: string;
  elo?: number;
  eloHistory?: game[];
  isVerified?: boolean;
  totalRankedGames?: number;
  colors?: colors;
  gameBoard?: gameBoard;
  date?: Date;
}

export const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  googleId: {
    type: String,
  },
  email: {
    type: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  colors: {
    enemyColor: {
      type: String,
      default: "#ff2079",
    },
    playerColor: {
      type: String,
      default: "#00b3fe",
    },
  },
  gameBoard: {
    type: String,
    default: "normal",
  },
  elo: {
    type: Number,
    default: 1000,
  },
  totalRankedGames: {
    type: Number,
    default: 0,
  },
  eloHistory: [
    {
      timestamp: {
        type: Date,
        default: Date.now(),
      },
      currElo: {
        type: Number,
      },
    },
  ],
});

const User = mongoose.model<IUser>("User", UserSchema);

export default User;
