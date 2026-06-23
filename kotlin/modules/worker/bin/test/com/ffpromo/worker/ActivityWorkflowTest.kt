package com.ffpromo.worker

import com.ffpromo.worker.activities.PersistRunStateActivity
import io.temporal.activity.ActivityInterface
import io.temporal.activity.ActivityMethod
import io.temporal.activity.ActivityOptions
import io.temporal.client.WorkflowOptions
import io.temporal.testing.TestWorkflowEnvironment
import io.temporal.worker.Worker
import io.temporal.workflow.Workflow
import io.temporal.workflow.WorkflowInterface
import io.temporal.workflow.WorkflowMethod
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Timeout
import java.time.Duration
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class ActivityWorkflowTest {
    @WorkflowInterface
    interface SingleActivityWorkflow {
        @WorkflowMethod
        fun run(runId: String): Int
    }

    class SingleActivityWorkflowImpl : SingleActivityWorkflow {
        private val persistRunState: PersistRunStateActivity =
            Workflow.newActivityStub(
                PersistRunStateActivity::class.java,
                ActivityOptions.newBuilder()
                    .setStartToCloseTimeout(Duration.ofSeconds(5))
                    .build(),
            )

        override fun run(runId: String): Int {
            persistRunState.persistRunState(runId, "active", null, null)
            return 1
        }
    }

    @Test
    @Timeout(value = 15, unit = TimeUnit.SECONDS)
    fun `workflow invokes persist activity once`() {
        val calls = AtomicInteger(0)
        val testEnv = TestWorkflowEnvironment.newInstance()
        val worker: Worker = testEnv.newWorker("promotion")
        worker.registerWorkflowImplementationTypes(SingleActivityWorkflowImpl::class.java)
        worker.registerActivitiesImplementations(
            object : PersistRunStateActivity {
                override fun persistRunState(
                    promotionRunId: String,
                    status: String,
                    currentStageIndex: Int?,
                    pauseReason: String?,
                ) {
                    calls.incrementAndGet()
                }
            },
        )
        testEnv.start()

        val workflow = testEnv.workflowClient.newWorkflowStub(
            SingleActivityWorkflow::class.java,
            WorkflowOptions.newBuilder().setTaskQueue("promotion").build(),
        )

        assertEquals(1, workflow.run("run-1"))
        assertEquals(1, calls.get())
        testEnv.close()
    }
}
