import { Router, type IRouter } from "express";
import healthRouter from "./health";
import identifyRouter from "./identify";
import historyRouter from "./history";
import trendingRouter from "./trending";
import songsRouter from "./songs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(identifyRouter);
router.use(historyRouter);
router.use(trendingRouter);
router.use(songsRouter);

export default router;
