import { Router, type IRouter } from "express";
import healthRouter        from "./health";
import usersRouter         from "./users";
import emailRouter         from "./email";
import integrationsRouter  from "./integrations";
import documentsRouter     from "./documents";
import reviewQueueRouter   from "./reviewQueue";
import portfolioRouter     from "./portfolio";
import adminRouter         from "./admin";
import dealStructureRouter from "./dealStructure";
import crmRouter           from "./crm";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users",          usersRouter);
router.use("/email",          emailRouter);
router.use("/integrations",   integrationsRouter);
router.use("/documents",      documentsRouter);
router.use("/review-queue",   reviewQueueRouter);
router.use("/portfolio",      portfolioRouter);
router.use("/deal-structure", dealStructureRouter);
router.use("/crm",            crmRouter);
// admin routes mount their own sub-paths (/admin/* and /billing/*)
router.use("/",               adminRouter);

export default router;
