"use strict";
import LocalStrategy from "passport-local";
import bcrypt from "bcryptjs";
import passport, { PassportStatic } from "passport";

// Load User Model
import User, { IUser } from "../models/User";
export default function(passport: PassportStatic) {
  passport.use(
    new LocalStrategy.Strategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      (username: string, password: string, done: Function) => {
        // Match user

        User.findOne({ email: username })
          .then((user) => {
            if (!user) {
              return done(null, false);
            }
            // Match password

            bcrypt.compare(
              password,
              user.password,
              (err: Error, isMatch: boolean) => {
                if (err) throw err;

                if (isMatch) {
                  return done(null, user);
                } else {
                  return done(null, false);
                }
              }
            );
          })
          .catch((err: Error) => console.log(err));
      }
    )
  );

  passport.serializeUser(function(user: IUser, done: Function) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id: string, done: Function) {
    User.findById(id, function(err, user) {
      done(err, user);
      if (err) console.log(err);
    });
  });
}
