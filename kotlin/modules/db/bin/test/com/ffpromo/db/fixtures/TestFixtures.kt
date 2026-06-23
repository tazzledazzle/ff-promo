package com.ffpromo.db.fixtures

import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.MetricType
import com.ffpromo.contracts.StageEnvironment
import com.ffpromo.contracts.StageInput

private val defaultGatePolicies = listOf(
    GatePolicyInput(
        metricType = MetricType.error_rate,
        threshold = 0.01,
        serviceName = "demo-service",
    ),
    GatePolicyInput(
        metricType = MetricType.latency_p95,
        threshold = 500.0,
        serviceName = "demo-service",
    ),
)

fun standardStages(serviceName: String = "demo-service"): List<StageInput> =
    listOf(
        StageInput(
            orderIndex = 0,
            environment = StageEnvironment.dev,
            displayName = "Development",
            gatePolicies = defaultGatePolicies.map { it.copy(serviceName = serviceName) },
        ),
        StageInput(
            orderIndex = 1,
            environment = StageEnvironment.staging,
            displayName = "Staging",
            gatePolicies = defaultGatePolicies.map { it.copy(serviceName = serviceName) },
        ),
        StageInput(
            orderIndex = 2,
            environment = StageEnvironment.prod,
            displayName = "Production",
            gatePolicies = defaultGatePolicies.map { it.copy(serviceName = serviceName) },
        ),
    )

fun singleDevStage(serviceName: String = "api"): List<StageInput> =
    listOf(
        StageInput(
            orderIndex = 0,
            environment = StageEnvironment.dev,
            displayName = "Dev",
            gatePolicies = listOf(
                GatePolicyInput(
                    metricType = MetricType.error_rate,
                    threshold = 0.01,
                    serviceName = serviceName,
                ),
            ),
        ),
    )
