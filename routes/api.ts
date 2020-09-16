"use strict";
// TODO replace any with Mongoose types
import express from "express";
const router = express.Router();
import bcrypt from "bcryptjs";
import passport from "passport";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import jwtAuth from "../config/jwtAuth";
import User from "../models/User";
import { Request, Response } from "express";

router.post("/register", (req: Request, res: Response) => {
  const { username, email, password, password2 } = req.body;
  let errors = [];
  // Check required fields
  if (!username || !email || !password || !password2) {
    errors.push({ msg: "Please fill in all the fields" });
  }

  // Check password match
  if (password !== password2) {
    errors.push({ msg: "Passwords don't match" });
  }

  // Check password strength
  if (password.length < 3) {
    errors.push({ msg: "Password must be longer" });
  }

  if (errors.length > 0) {
    console.log(errors);
    res.status(500).send(errors[0].msg);
  } else {
    // Validation passed
    User.findOne({ username: username }).then((user: any) => {
      if (user) {
        res.status(500).send("Username is already taken");
      } else {
        User.findOne({ email: email }).then((userEmail: any) => {
          if (userEmail) {
            res.status(500).send("Email is already taken");
          } else {
            // Hash Password
            bcrypt.genSalt(10, (err: Error, salt: string) =>
              bcrypt.hash(password, salt, (err: Error, hash: string) => {
                if (err) throw err;

                // Set password to hashed
                const newUser = new User({
                  username,
                  email,
                  password: hash,
                });
                // Save user
                newUser
                  .save()
                  .then((user: any) => {
                    res.status(200).send("Successfully registered");
                  })
                  .catch((err: Error) => console.log(err));
              })
            );
          }
        });
      }
    });
  }
});

router.post(
  "/login",
  passport.authenticate("local", { session: true }),
  function(req: Request, res: Response) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    res.status(200).send("");
  }
);

router.post("/googleLogin", (req: Request, res: Response) => {
  const { email } = req.body;
  User.findOne({ email: email }).then((user: any) => {
    if (user) {
      let token = jwt.sign(
        { __id: user._id, username: user.username },
        process.env.JWTSECRET as string
      );

      res
        .header("auth-token", token)
        .status(200)
        .send({ registered: true, username: user.username });
    } else {
      res.status(200).send({ registered: false, username: null });
    }
  });
});

router.post("/googleRegister", (req: Request, res: Response) => {
  const { email, username } = req.body;
  User.findOne({ username: username }).then((user: any) => {
    if (user) {
      res.status(401).send("Username taken");
    } else {
      const newUser = new User({ username, email });

      newUser
        .save()
        .then(() => {
          res.status(200).send("Successfully registered");
        })
        .catch((err: Error) => console.log(err));
    }
  });
});

router.post("/islogged", (req: Request, res: Response) => {
  if (req.user) {
    res.status(200).send(req.user);
  } else {
    // not logged in with local
    jwtAuth(req, res);
  }
});

router.post("/logout", (req: Request, res: Response) => {
  req.logout();
  res.status(200).send("Logged out");
});

router.post("/contact", (req: Request, res: Response) => {
  const { nickname, email, message } = req.body;
  if (!nickname || !email || !message) {
    res.status(500).send("Please fill in all the fields");
  } else {
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.eu",
      port: 465,
      secure: true, //ssl
      auth: {
        user: "admin@playgomoku.com ",
        pass: "REtkBLViPj2QCVU",
      },
    });
    const mailOptions = {
      from: "admin@playgomoku.com",
      to: "admin@playgomoku.com",
      subject: `${nickname}`,
      text: `${message}`,
      replyTo: `${email}`,
    };
    transporter.sendMail(mailOptions, function(err: Error | null, info: any) {
      if (err) {
        console.log(err);
        res.status(500).send("Unexpected problem");
      } else {
        res.status(200).send("Message sent");
      }
    });
  }
});

router.post("/changepassword", (req: Request, res: Response) => {
  const { username, password, password2 } = req.body;
  let errors = [];
  // Check required fields
  if (!password || !password2) {
    errors.push({ msg: "Please fill in all the fields" });
  }

  // Check password match
  if (password !== password2) {
    errors.push({ msg: "Passwords don't match" });
  }

  // Check password strength
  if (password.length < 8) {
    errors.push({ msg: "Password is shorter than 8 characters" });
  }

  if (errors.length > 0) {
    res.render("settings", {
      active_page: "",
      logged: false,
      errors,
      username,
      password,
      password2,
    });
  } else {
    // * Hashing password
    bcrypt.genSalt(10, (err: Error, salt: string) =>
      bcrypt.hash(password, salt, (err: Error, hash: string) => {
        let updatePass = User.findOneAndUpdate(
          { username: username },
          { password: hash }
        ).then(function() {
          res.status(200).send("Password changed");
        });
      })
    );
  }
});

export { router as apiRouter };
