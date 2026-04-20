import dotenv from "dotenv";
dotenv.config({ path: "/Users/ashishsingh/Desktop/nexus-os/apps/api/.env" });
import { decomposeGoal } from "./src/semanticRouter.ts";

decomposeGoal("Build a go-to-market strategy for a B2B SaaS startup targeting HR teams")
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(err => console.error("FATAL:", err));
