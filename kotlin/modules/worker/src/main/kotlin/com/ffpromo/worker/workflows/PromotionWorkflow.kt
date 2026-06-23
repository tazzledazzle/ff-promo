package com.ffpromo.worker.workflows

import com.ffpromo.contracts.AuditAction
import com.ffpromo.contracts.ActorType
import com.ffpromo.contracts.PromotionStatus
import com.ffpromo.worker.activities.EvaluateGateActivity
import com.ffpromo.worker.activities.PersistRunStateActivity
import com.ffpromo.worker.activities.RecordAuditEventActivity
import io.temporal.activity.ActivityOptions
import io.temporal.common.RetryOptions
import io.temporal.workflow.SignalMethod
import io.temporal.workflow.Workflow
import io.temporal.workflow.WorkflowInterface
import io.temporal.workflow.WorkflowMethod
import java.time.Duration

@WorkflowInterface
interface PromotionWorkflow {
    @WorkflowMethod
    fun run(promotionRunId: String, pipelineId: String, flagKey: String)

    @SignalMethod(name = PromotionSignals.PAUSE)
    fun pause()

    @SignalMethod(name = PromotionSignals.RESUME)
    fun resume()

    @SignalMethod(name = PromotionSignals.ABORT)
    fun abort()
}

class PromotionWorkflowImpl : PromotionWorkflow {
    private val activityOptions = ActivityOptions.newBuilder()
        .setStartToCloseTimeout(Duration.ofSeconds(30))
        .setRetryOptions(RetryOptions.newBuilder().setMaximumAttempts(3).build())
        .build()

    private val persistRunState: PersistRunStateActivity =
        Workflow.newActivityStub(PersistRunStateActivity::class.java, activityOptions)
    private val recordAuditEvent: RecordAuditEventActivity =
        Workflow.newActivityStub(RecordAuditEventActivity::class.java, activityOptions)
    private val evaluateGate: EvaluateGateActivity =
        Workflow.newActivityStub(EvaluateGateActivity::class.java, activityOptions)

    private var currentStageIndex = 0
    private var status = "active"
    private var isPaused = false
    private var pauseRequested = false
    private var resumeRequested = false
    private var abortRequested = false
    private val stageCount = 3
    private var workflowPromotionRunId = ""

    override fun pause() {
        pauseRequested = true
    }

    override fun resume() {
        resumeRequested = true
    }

    override fun abort() {
        abortRequested = true
    }

    override fun run(promotionRunId: String, pipelineId: String, flagKey: String) {
        workflowPromotionRunId = promotionRunId

        persistRunState.persistRunState(
            promotionRunId,
            PromotionStatus.active.name,
            null,
            null,
        )
        recordAuditEvent.recordAuditEvent(
            promotionRunId,
            AuditAction.run_started.name,
            ActorType.system.name,
            "workflow",
            null,
            null,
            null,
        )

        while (currentStageIndex < stageCount && !hasAborted()) {
            applyPendingSignals()
            if (hasAborted()) break

            if (isPaused) {
                Workflow.await(Duration.ofDays(365)) { resumeRequested || abortRequested }
                applyPendingSignals()
                if (hasAborted()) break
                if (isPaused) continue
            }

            recordAuditEvent.recordAuditEvent(
                promotionRunId,
                AuditAction.stage_entered.name,
                ActorType.system.name,
                "workflow",
                null,
                null,
                """{"stageIndex":$currentStageIndex}""",
            )

            val gateResultId = evaluateGate.evaluateGate(promotionRunId, currentStageIndex)

            currentStageIndex += 1
            persistRunState.persistRunState(
                promotionRunId,
                PromotionStatus.active.name,
                currentStageIndex,
                null,
            )
            recordAuditEvent.recordAuditEvent(
                promotionRunId,
                AuditAction.stage_advanced.name,
                ActorType.system.name,
                "workflow",
                null,
                gateResultId,
                """{"stageIndex":$currentStageIndex}""",
            )
        }

        if (!hasAborted()) {
            status = "completed"
            persistRunState.persistRunState(
                promotionRunId,
                PromotionStatus.completed.name,
                null,
                null,
            )
            recordAuditEvent.recordAuditEvent(
                promotionRunId,
                AuditAction.run_completed.name,
                ActorType.system.name,
                "workflow",
                null,
                null,
                null,
            )
        }
    }

    private fun applyPendingSignals() {
        if (abortRequested) {
            abortRequested = false
            status = "aborted"
            persistRunState.persistRunState(
                workflowPromotionRunId,
                PromotionStatus.aborted.name,
                null,
                null,
            )
            recordAuditEvent.recordAuditEvent(
                workflowPromotionRunId,
                AuditAction.run_aborted.name,
                ActorType.system.name,
                "workflow",
                null,
                null,
                null,
            )
        }

        if (pauseRequested) {
            pauseRequested = false
            isPaused = true
            status = "paused"
            persistRunState.persistRunState(
                workflowPromotionRunId,
                PromotionStatus.paused.name,
                null,
                null,
            )
            recordAuditEvent.recordAuditEvent(
                workflowPromotionRunId,
                AuditAction.run_paused.name,
                ActorType.system.name,
                "workflow",
                null,
                null,
                null,
            )
        }

        if (resumeRequested) {
            resumeRequested = false
            isPaused = false
            status = "active"
            persistRunState.persistRunState(
                workflowPromotionRunId,
                PromotionStatus.active.name,
                null,
                null,
            )
            recordAuditEvent.recordAuditEvent(
                workflowPromotionRunId,
                AuditAction.run_resumed.name,
                ActorType.system.name,
                "workflow",
                null,
                null,
                null,
            )
        }
    }

    private fun hasAborted(): Boolean = status == "aborted"
}
