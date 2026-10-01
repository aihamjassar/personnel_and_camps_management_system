import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { personnelRouter } from "./routes/personnel.js";
import { campsRouter, unitsRouter, ranksRouter, positionsRouter, assignmentsRouter } from "./routes/reference.js";
import { usersRouter } from "./routes/users.js";
import { reportsRouter } from "./routes/reports.js";
import { auditRouter } from "./routes/audit.js";
import { transfersRouter } from "./routes/transfers.js";
import { rolesRouter } from "./routes/roles.js";
import { fail } from "./lib/response.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  // Public liveness probe: intentionally exposes no operational or database details.
  app.get("/api/v1/health", (_req, res) =>
    res.json({ status: "success", data: { ok: true }, error: null }),
  );

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/personnel", personnelRouter);
  app.use("/api/v1/camps", campsRouter);
  app.use("/api/v1/units", unitsRouter);
  app.use("/api/v1/ranks", ranksRouter);
  app.use("/api/v1/positions", positionsRouter);
  app.use("/api/v1/assignments", assignmentsRouter);
  app.use("/api/v1/transfers", transfersRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/roles", rolesRouter);
  app.use("/api/v1/reports", reportsRouter);
  app.use("/api/v1/audit", auditRouter);

  app.use("/api", (_req, res) => fail(res, 404, "Endpoint not found"));
  app.use(errorHandler);
  return app;
}
