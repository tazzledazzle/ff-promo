package com.ffpromo.telemetry.evaluate

import com.ffpromo.contracts.GatePolicyInput
import com.ffpromo.contracts.GateRunContext
import com.ffpromo.contracts.GateVerdictResult
import com.ffpromo.contracts.StageGateEvaluation
import com.ffpromo.telemetry.client.PrometheusClient

suspend fun evaluateStageGates(
    client: PrometheusClient,
    policies: List<GatePolicyInput>,
    runContext: GateRunContext,
): StageGateEvaluation {
    val results = policies.map { policy ->
        evaluateGatePolicy(client, policy, runContext)
    }

    val verdict = if (results.all { it.verdict == GateVerdictResult.pass }) {
        GateVerdictResult.pass
    } else {
        GateVerdictResult.fail
    }

    return StageGateEvaluation(verdict = verdict, results = results)
}
