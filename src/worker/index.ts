import { env } from "../config/env.js";

console.log(`Worker started in ${env.NODE_ENV} mode.`);
console.log("Next step: schedule opening, locking, result fetching, scoring and publishing jobs.");
