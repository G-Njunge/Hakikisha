import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import medicinesRouter from "./routes/medicines";
import pharmaciesRouter from "./routes/pharmacies";
import scansRouter from "./routes/scans";
import reportsRouter from "./routes/reports";

const app = express();

// Origins never have a trailing slash, but env vars are easy to mistype with
// one — strip it so a stray "/" in CLIENT_URL can't silently break every
// cross-origin request with a CORS mismatch that looks like a backend bug.
const clientUrl = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/+$/, "");

app.use(cors({ origin: clientUrl }));
// Raised from Express's 100kb default so report submissions can carry a
// base64-encoded photo (interim storage until real object-storage/URLs).
app.use(express.json({ limit: "8mb" }));

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/medicines", medicinesRouter);
app.use("/api/pharmacies", pharmaciesRouter);
app.use("/api/scans", scansRouter);
app.use("/api/reports", reportsRouter);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
