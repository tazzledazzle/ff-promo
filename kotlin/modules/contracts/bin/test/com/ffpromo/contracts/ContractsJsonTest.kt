package com.ffpromo.contracts

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class ContractsJsonTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `decodes golden PipelineCreateInput JSON matching v1 wire format`() {
        val golden = """
            {
              "name": "demo-pipeline",
              "flagKey": "demo-flag",
              "projectKey": "demo-project",
              "description": "Demo pipeline",
              "stages": [
                {
                  "orderIndex": 0,
                  "environment": "dev",
                  "displayName": "Development",
                  "gatePolicies": [
                    {
                      "metricType": "error_rate",
                      "threshold": 0.05,
                      "serviceName": "demo-service"
                    },
                    {
                      "metricType": "latency_p95",
                      "threshold": 500,
                      "serviceName": "demo-service",
                      "windowSeconds": 300
                    }
                  ]
                }
              ]
            }
        """.trimIndent()

        val input = json.decodeFromString<PipelineCreateInput>(golden)

        assertEquals("demo-pipeline", input.name)
        assertEquals("demo-flag", input.flagKey)
        assertEquals(StageEnvironment.dev, input.stages.single().environment)
        assertEquals(MetricType.error_rate, input.stages.single().gatePolicies.first().metricType)
    }

    @Test
    fun `round-trips AuditEventInput with snake_case enum values`() {
        val original = AuditEventInput(
            promotionRunId = "run_abc",
            action = AuditAction.run_started,
            actorType = ActorType.api_key,
            actorId = "key_123",
            displayName = "CI Bot",
        )

        val decoded = json.decodeFromString<AuditEventInput>(json.encodeToString(original))

        assertEquals(AuditAction.run_started, decoded.action)
        assertEquals(ActorType.api_key, decoded.actorType)
        assertNotNull(decoded.promotionRunId)
    }

    @Test
    fun `decodes PersistRunStateInput for worker stub`() {
        val golden = """
            {
              "promotionRunId": "run_xyz",
              "status": "paused",
              "pauseReason": "gate breach"
            }
        """.trimIndent()

        val input = json.decodeFromString<PersistRunStateInput>(golden)

        assertEquals(PromotionStatus.paused, input.status)
        assertEquals("gate breach", input.pauseReason)
    }
}
