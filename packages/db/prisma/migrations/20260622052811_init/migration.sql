-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('user', 'system', 'api_key');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('pending', 'active', 'paused', 'completed', 'aborted');

-- CreateEnum
CREATE TYPE "GateVerdict" AS ENUM ('pass', 'fail', 'pending', 'skipped');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('run_started', 'run_paused', 'run_resumed', 'run_aborted', 'run_completed', 'stage_entered', 'stage_advanced', 'gate_evaluated');

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "flagKey" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "environment" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatePolicy" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "comparisonMode" TEXT NOT NULL DEFAULT 'absolute',
    "windowSeconds" INTEGER NOT NULL DEFAULT 300,
    "minSampleSize" INTEGER NOT NULL DEFAULT 0,
    "serviceName" TEXT NOT NULL,

    CONSTRAINT "GatePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRun" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "pipelineVersion" INTEGER NOT NULL,
    "flagKey" TEXT NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'pending',
    "currentStageIndex" INTEGER NOT NULL DEFAULT 0,
    "temporalWorkflowId" TEXT,
    "pauseReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateResult" (
    "id" TEXT NOT NULL,
    "promotionRunId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "verdict" "GateVerdict" NOT NULL,
    "metricType" TEXT NOT NULL,
    "observedValue" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "promotionRunId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "displayName" TEXT,
    "gateResultId" TEXT,
    "metadata" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pipeline_flagKey_idx" ON "Pipeline"("flagKey");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_name_version_key" ON "Pipeline"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_pipelineId_orderIndex_key" ON "Stage"("pipelineId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_pipelineId_environment_key" ON "Stage"("pipelineId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "GatePolicy_stageId_metricType_key" ON "GatePolicy"("stageId", "metricType");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRun_temporalWorkflowId_key" ON "PromotionRun"("temporalWorkflowId");

-- CreateIndex
CREATE INDEX "PromotionRun_status_idx" ON "PromotionRun"("status");

-- CreateIndex
CREATE INDEX "PromotionRun_flagKey_status_idx" ON "PromotionRun"("flagKey", "status");

-- CreateIndex
CREATE INDEX "GateResult_promotionRunId_evaluatedAt_idx" ON "GateResult"("promotionRunId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_promotionRunId_occurredAt_idx" ON "AuditEvent"("promotionRunId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatePolicy" ADD CONSTRAINT "GatePolicy_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateResult" ADD CONSTRAINT "GateResult_promotionRunId_fkey" FOREIGN KEY ("promotionRunId") REFERENCES "PromotionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateResult" ADD CONSTRAINT "GateResult_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_promotionRunId_fkey" FOREIGN KEY ("promotionRunId") REFERENCES "PromotionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_gateResultId_fkey" FOREIGN KEY ("gateResultId") REFERENCES "GateResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
