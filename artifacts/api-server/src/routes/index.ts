import { Router, type IRouter } from "express";
import healthRouter from "./health";
import customersRouter from "./customers";
import partsRouter from "./parts";
import dashboardRouter from "./dashboard";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(customersRouter);
router.use(partsRouter);
router.use(dashboardRouter);
router.use(searchRouter);

export default router;
