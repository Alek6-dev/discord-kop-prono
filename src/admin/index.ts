import Fastify from "fastify";
import { env } from "../config/env.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  service: "discord-kop-prono-admin"
}));

app.get("/", async () => ({
  name: "Discord KOP Prono Admin",
  status: "admin shell ready"
}));

await app.listen({
  host: env.ADMIN_HOST,
  port: env.ADMIN_PORT
});
