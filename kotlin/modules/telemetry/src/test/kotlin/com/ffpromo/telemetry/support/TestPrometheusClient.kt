package com.ffpromo.telemetry.support

import com.ffpromo.telemetry.client.PrometheusClient
import com.ffpromo.telemetry.client.PrometheusInstantQueryData
import com.ffpromo.telemetry.client.ResolvedPrometheusConfig
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject

fun vector(value: String): PrometheusInstantQueryData =
    PrometheusInstantQueryData(
        resultType = "vector",
        result = buildJsonArray {
            add(
                buildJsonObject {
                    put("metric", buildJsonObject {})
                    put(
                        "value",
                        buildJsonArray {
                            add(JsonPrimitive(0))
                            add(JsonPrimitive(value))
                        },
                    )
                },
            )
        },
    )

class QueuePrometheusClient(
    private val responses: MutableList<PrometheusInstantQueryData>,
) : PrometheusClient {
    override val config = ResolvedPrometheusConfig(baseUrl = "http://localhost:9090")

    override suspend fun queryInstant(query: String, timeout: String?): PrometheusInstantQueryData =
        responses.removeFirstOrNull() ?: vector("0")
}

fun metadataReason(result: com.ffpromo.contracts.GateEvaluationResult): String? =
    result.metadata["reason"]?.let { (it as? JsonPrimitive)?.content }
