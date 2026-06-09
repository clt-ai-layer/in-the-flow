import { projections } from "@event-driven-io/emmett";
import { dailyTaskProjection } from "@/dailyTask/projections/dailyTaskProjection.js";
import { projectListProjection } from "@/project/projections/projectListProjection.js";
import { settingsProjection } from "@/settings/projections/settingsProjection.js";
import { taskListProjection } from "@/task/projections/taskListProjection.js";
import { databaseViewListProjection } from "@/views/projections/databaseViewListProjection.js";

/**
 * All inline projections registered with the MongoDB event store.
 */
export const inlineProjections = projections.inline([
  taskListProjection,
  projectListProjection,
  dailyTaskProjection,
  settingsProjection,
  databaseViewListProjection,
]);
