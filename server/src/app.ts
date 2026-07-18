import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import medicinesRouter from "./routes/medicines";
import pharmaciesRouter from "./routes/pharmacies";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/medicines", medicinesRouter);
app.use("/api/pharmacies", pharmaciesRouter);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
