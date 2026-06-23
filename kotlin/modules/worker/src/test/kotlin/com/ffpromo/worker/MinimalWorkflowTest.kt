package com.ffpromo.worker

import io.temporal.testing.TestWorkflowEnvironment
import io.temporal.worker.Worker
import io.temporal.workflow.WorkflowInterface
import io.temporal.workflow.WorkflowMethod
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Timeout
import java.util.concurrent.TimeUnit

class MinimalWorkflowTest {
    @WorkflowInterface
    interface TrivialWorkflow {
        @WorkflowMethod
        fun run(): String
    }

    class TrivialWorkflowImpl : TrivialWorkflow {
        override fun run(): String = "done"
    }

    @Test
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    fun `test environment executes trivial workflow`() {
        val testEnv = TestWorkflowEnvironment.newInstance()
        val worker: Worker = testEnv.newWorker("trivial-queue")
        worker.registerWorkflowImplementationTypes(TrivialWorkflowImpl::class.java)
        testEnv.start()

        val workflow = testEnv.workflowClient.newWorkflowStub(
            TrivialWorkflow::class.java,
            io.temporal.client.WorkflowOptions.newBuilder()
                .setTaskQueue("trivial-queue")
                .build(),
        )

        assertEquals("done", workflow.run())
        testEnv.close()
    }
}
