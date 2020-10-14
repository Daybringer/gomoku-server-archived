import jwt from "jsonwebtoken";
import { Request, Response } from "express";

export default function jwtAuth(req: Request, res: Response) {
  const token = req.header("auth-token");

  // True if auth-token undefined <== missing auth-token in Request header
  if (!token) return res.status(401).send("Access Denied");

  try {
    const verified = jwt.verify(token, process.env.JWTSECRET as string);
    req.user = verified;
    res.status(200).send(verified);
  } catch (err) {
    console.log(err);
    console.log("classic error");
    res.send(false);
  }
}
