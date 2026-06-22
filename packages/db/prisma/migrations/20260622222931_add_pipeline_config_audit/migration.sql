-- CreateEnum
CREATE TYPE "PipelineConfigAction" AS ENUM ('pipeline_created', 'pipeline_deactivated', 'pipeline_updated');

-- CreateTable
CREATE TABLE "PipelineConfigAudit" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "action" "PipelineConfigAction" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "displayName" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineConfigAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineConfigAudit_pipelineId_occurredAt_idx" ON "PipelineConfigAudit"("pipelineId", "occurredAt");

-- AddForeignKey
ALTER TABLE "PipelineConfigAudit" ADD CONSTRAINT "PipelineConfigAudit_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
