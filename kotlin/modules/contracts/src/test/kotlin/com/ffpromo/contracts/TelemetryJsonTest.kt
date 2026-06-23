package com.ffpromo.contracts

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class TelemetryJsonTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `decodes golden GateRunContext JSON matching v1 wire format`() {
        val golden = """
            {
              "flagKey": "demo-feature-flag",
              "treatmentVariationId": "treatment-var",
              "controlVariationId": "control-var",
              "environmentKey": "production"
            }
        """.trimIndent()

        val context = json.decodeFromString<GateRunContext>(golden)

        assertEquals("demo-feature-flag", context.flagKey)
        assertEquals("treatment-var", context.treatmentVariationId)
        assertEquals("control-var", context.controlVariationId)
        assertEquals("production", context.environmentKey)
    }
}
