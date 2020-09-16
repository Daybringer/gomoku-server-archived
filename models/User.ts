"use strict";
import mongoose from "mongoose";

enum gameBoard {
  NORMAL = "normal",
  TRADITIONAL = "traditional",
  MODERN = "modern",
}

export interface eloHistory {}

export interface colors {
  enemeyColor: string;
  playerColor: string;
}

export interface IUser extends mongoose.Document {
  username: string;
  googleId?: string;
  password?: string;
  email?: string;
  elo?: number;
  eloHistory?: eloHistory;
  isVerified?: boolean;
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
      default: "",
    },
    playerColor: {
      default: "",
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
});

const User = mongoose.model<IUser>("User", UserSchema);

export default User;
