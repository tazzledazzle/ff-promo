package com.ffpromo.worker

import com.ffpromo.worker.activities.EvaluateGateActivityImpl
import com.ffpromo.worker.activities.PersistRunStateActivityImpl
import com.ffpromo.worker.activities.RecordAuditEventActivityImpl
import com.ffpromo.worker.workflows.PromotionWorkflowImpl
import io.temporal.client.WorkflowClient
import io.temporal.serviceclient.WorkflowServiceStubs
import io.temporal.serviceclient.WorkflowServiceStubsOptions
import io.temporal.worker.WorkerFactory
import java.net.URI

fun main() {
    val temporalAddress = System.getenv("TEMPORAL_ADDRESS") ?: "localhost:7233"
    val taskQueue = System.getenv("TEMPORAL_TASK_QUEUE") ?: "promotion"
    val databaseUrl = System.getenv("DATABASE_URL")

    val dbHost = databaseUrl?.let { redactDatabaseUrl(it) } ?: "(DATABASE_URL not set)"

    println("Starting ff-promo Kotlin worker")
    println("  task queue: $taskQueue")
    println("  temporal:   $temporalAddress")
    println("  database:   $dbHost")

    val service = WorkflowServiceStubs.newServiceStubs(
        WorkflowServiceStubsOptions.newBuilder()
            .setTarget(temporalAddress)
            .build(),
    )
    val client = WorkflowClient.newInstance(service)
    val factory = WorkerFactory.newInstance(client)
    val worker = factory.newWorker(taskQueue)

    worker.registerWorkflowImplementationTypes(PromotionWorkflowImpl::class.java)
    worker.registerActivitiesImplementations(
        PersistRunStateActivityImpl(),
        RecordAuditEventActivityImpl(),
        EvaluateGateActivityImpl(),
    )

    factory.start()
    println("ff-promo Kotlin worker started on task queue \"$taskQueue\" ($temporalAddress)")

    Runtime.getRuntime().addShutdownHook(
        Thread {
            println("Shutting down worker...")
            factory.shutdown()
            service.shutdown()
        },
    )

    Thread.currentThread().join()
}

private fun redactDatabaseUrl(url: String): String =
    try {
        val normalized = if (url.startsWith("jdbc:")) url else "jdbc:$url"
        val uri = URI(normalized.replace("jdbc:", ""))
        val host = uri.host ?: "unknown"
        val port = if (uri.port > 0) ":${uri.port}" else ""
        val path = uri.path ?: ""
        "postgresql://***@${host}${port}${path}"
    } catch (_: Exception) {
        "postgresql://***@(redacted)"
    }
