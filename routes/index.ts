"use strict";
import express from "express";
const router = express.Router();

import { Request, Response } from "express";

router.post("/port", function(req: Request, res: Response) {
  // If this function gets called, authentication was successful.
  // `req.user` contains the authenticated user.
  res.status(200).send(process.env.PORT || 3000);
});

export { router as indexRouter };
