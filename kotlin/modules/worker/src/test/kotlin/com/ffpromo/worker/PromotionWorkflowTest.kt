package com.ffpromo.worker

import com.ffpromo.worker.activities.EvaluateGateActivity
import com.ffpromo.worker.activities.PersistRunStateActivity
import com.ffpromo.worker.activities.RecordAuditEventActivity
import com.ffpromo.worker.workflows.PromotionSignals
import com.ffpromo.worker.workflows.PromotionWorkflow
import com.ffpromo.worker.workflows.PromotionWorkflowImpl
import io.temporal.client.WorkflowClient
import io.temporal.client.WorkflowOptions
import io.temporal.testing.TestWorkflowEnvironment
import io.temporal.worker.Worker
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Timeout
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class PromotionWorkflowTest {
    private lateinit var testEnv: TestWorkflowEnvironment
    private val persistCalls = AtomicInteger(0)
    private val auditCalls = AtomicInteger(0)
    private val gateCalls = AtomicInteger(0)
    private var firstGateEntered = CountDownLatch(1)
    private var releaseGate = CountDownLatch(1)

    @BeforeEach
    fun setUp() {
        persistCalls.set(0)
        auditCalls.set(0)
        gateCalls.set(0)
        firstGateEntered = CountDownLatch(1)
        releaseGate = CountDownLatch(1)

        testEnv = TestWorkflowEnvironment.newInstance()
        val worker: Worker = testEnv.newWorker(TASK_QUEUE)
        worker.registerWorkflowImplementationTypes(PromotionWorkflowImpl::class.java)
        worker.registerActivitiesImplementations(
            object : PersistRunStateActivity {
                override fun persistRunState(
                    promotionRunId: String,
                    status: String,
                    currentStageIndex: Int?,
                    pauseReason: String?,
                ) {
                    persistCalls.incrementAndGet()
                }
            },
            object : RecordAuditEventActivity {
                override fun recordAuditEvent(
                    promotionRunId: String,
                    action: String,
                    actorType: String,
                    actorId: String,
                    displayName: String?,
                    gateResultId: String?,
                    metadataJson: String?,
                ) {
                    auditCalls.incrementAndGet()
                }
            },
            object : EvaluateGateActivity {
                override fun evaluateGate(promotionRunId: String, stageIndex: Int): String {
                    gateCalls.incrementAndGet()
                    if (promotionRunId == "run-pause" && stageIndex == 0) {
                        firstGateEntered.countDown()
                        releaseGate.await(5, TimeUnit.SECONDS)
                    }
                    return "gate-${gateCalls.get()}"
                }
            },
        )
        testEnv.start()
    }

    @AfterEach
    fun tearDown() {
        testEnv.close()
    }

    @Test
    @Timeout(value = 15, unit = TimeUnit.SECONDS)
    fun `workflow completes stage loop when gates pass`() {
        val workflow = newWorkflowStub("run-complete")
        workflow.run("run-complete", "pipeline-1", "flag-a")

        assertTrue(persistCalls.get() >= 4, "persistRunState calls: ${persistCalls.get()}")
        assertTrue(gateCalls.get() >= 3, "evaluateGate calls: ${gateCalls.get()}")
        assertTrue(auditCalls.get() >= 3, "recordAuditEvent calls: ${auditCalls.get()}")
    }

    @Test
    @Timeout(value = 15, unit = TimeUnit.SECONDS)
    fun `abort signal stops workflow`() {
        val workflow = newWorkflowStub("run-abort")

        WorkflowClient.start(workflow::run, "run-abort", "pipeline-1", "flag-a")
        testEnv.sleep(java.time.Duration.ofMillis(50))
        workflow.abort()
        testEnv.sleep(java.time.Duration.ofSeconds(2))

        assertTrue(persistCalls.get() >= 2, "persistRunState calls: ${persistCalls.get()}")
    }

    @Test
    @Timeout(value = 15, unit = TimeUnit.SECONDS)
    fun `pause and resume signal handling smoke test`() {
        val workflow = newWorkflowStub("run-pause")

        WorkflowClient.start(workflow::run, "run-pause", "pipeline-1", "flag-a")
        assertTrue(firstGateEntered.await(5, TimeUnit.SECONDS))
        workflow.pause()
        testEnv.sleep(java.time.Duration.ofMillis(200))
        workflow.resume()
        releaseGate.countDown()
        testEnv.sleep(java.time.Duration.ofSeconds(2))

        assertTrue(persistCalls.get() >= 3, "persistRunState calls: ${persistCalls.get()}")
        assertTrue(auditCalls.get() >= 2, "recordAuditEvent calls: ${auditCalls.get()}")
    }

    private fun newWorkflowStub(workflowId: String): PromotionWorkflow =
        testEnv.workflowClient.newWorkflowStub(
            PromotionWorkflow::class.java,
            WorkflowOptions.newBuilder()
                .setTaskQueue(TASK_QUEUE)
                .setWorkflowId(workflowId)
                .build(),
        )

    companion object {
        private const val TASK_QUEUE = "promotion"
    }
}
