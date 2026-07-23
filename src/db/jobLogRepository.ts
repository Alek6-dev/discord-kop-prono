import { randomUUID } from "node:crypto";
import { db } from "./client.js";
import { jobLogs } from "./schema.js";

export class PgJobLogRepository {
  async create(input: {
    jobName: string;
    status: "success" | "skipped" | "error";
    grandPrixId?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await db.insert(jobLogs).values({
      id: randomUUID(),
      jobName: input.jobName,
      status: input.status,
      grandPrixId: input.grandPrixId,
      message: input.message,
      metadata: input.metadata ?? {}
    });
  }
}
