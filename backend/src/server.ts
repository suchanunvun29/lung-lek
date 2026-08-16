import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth.routes";
import userRouter from "./routes/user.routes";
import importRouter from "./routes/import.routes";
import salespersonRouter from "./routes/salesperson.routes";
import hospitalRouter from "./routes/hospital.routes";
import productTypeRouter from "./routes/productType.routes";
import targetRouter from "./routes/target.routes";
import kpiRouter from "./routes/kpi.routes";
import settingsRouter from "./routes/settings.routes";
import leaderboardRouter from "./routes/leaderboard.routes";
import coachingInsightRouter from "./routes/coachingInsight.routes";
import reportRouter from "./routes/report.routes";
import hospitalNameReviewRouter from "./routes/hospitalNameReview.routes";
import salesmanNameRuleRouter from "./routes/salesmanNameRule.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/", importRouter);
app.use("/salespeople", salespersonRouter);
app.use("/hospitals", hospitalRouter);
app.use("/product-types", productTypeRouter);
app.use("/targets", targetRouter);
app.use("/kpi", kpiRouter);
app.use("/settings", settingsRouter);
app.use("/leaderboard", leaderboardRouter);
app.use("/coaching-insights", coachingInsightRouter);
app.use("/reports", reportRouter);
app.use("/hospital-name-reviews", hospitalNameReviewRouter);
app.use("/salesman-name-rules", salesmanNameRuleRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express only treats a 4-arg function as error middleware
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
