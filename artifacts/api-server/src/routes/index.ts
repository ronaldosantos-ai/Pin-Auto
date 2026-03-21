import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRouter from "./generate";
import historyRouter from "./history";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRouter);
router.use(historyRouter);

export default router;
