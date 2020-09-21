"use strict";

import { Request, Response, NextFunction } from "express";
export default {
  ensureAuthenticated: function(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/login");
  },
  checkAuthenticated: function(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    req.isAuthenticated() ? (res.logged = true) : (res.logged = false);
    return next();
  },
};
