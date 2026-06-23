package com.ffpromo.ldadapter.write

import com.ffpromo.contracts.ApplyTargetingInput
import com.ffpromo.contracts.FlagState
import com.ffpromo.contracts.RolloutIntent
import com.ffpromo.ldadapter.client.LdApiClient
import com.ffpromo.ldadapter.client.RateLimitedLdClient
import com.ffpromo.ldadapter.read.getFlagState
import com.ffpromo.ldadapter.read.GetFlagStateDeps
import com.ffpromo.ldadapter.resolve.resolveRuleId
import com.ffpromo.ldadapter.resolve.resolveVariationId

data class ApplyTargetingDeps(
    val rateLimitedClient: RateLimitedLdClient,
)

suspend fun applyTargeting(deps: ApplyTargetingDeps, input: ApplyTargetingInput): FlagState {
    val rateLimitedClient = deps.rateLimitedClient
    val rawClient = rateLimitedClient.rawClient
    val apiClient = LdApiClient(rawClient)

    val flagState = rateLimitedClient.schedule {
        getFlagState(
            GetFlagStateDeps(rawClient),
            com.ffpromo.contracts.GetFlagStateInput(
                projectKey = input.projectKey,
                flagKey = input.flagKey,
                environmentKey = input.intent.environmentKey,
            ),
        )
    }

    val resolved = resolveRolloutIds(flagState, input.intent.environmentKey, input.intent.rollout)
    val patchBody = buildTargetingPatchBody(input.intent, resolved)

    rateLimitedClient.schedule {
        apiClient.patchFeatureFlag(input.projectKey, input.flagKey, patchBody)
    }

    return rateLimitedClient.schedule {
        getFlagState(
            GetFlagStateDeps(rawClient),
            com.ffpromo.contracts.GetFlagStateInput(
                projectKey = input.projectKey,
                flagKey = input.flagKey,
                environmentKey = input.intent.environmentKey,
            ),
        )
    }
}

private fun resolveRolloutIds(
    flagState: FlagState,
    environmentKey: String,
    rollout: RolloutIntent?,
): ResolvedRolloutIds? {
    if (rollout == null) return null

    val resolved = ResolvedRolloutIds(
        treatmentVariationId = resolveVariationId(flagState, rollout.treatmentVariationRef),
        controlVariationId = resolveVariationId(flagState, rollout.controlVariationRef),
    )

    return if (rollout.mode == "rule") {
        val ruleRef = rollout.ruleRef ?: error("ruleRef required when rollout.mode is rule")
        resolved.copy(ruleId = resolveRuleId(flagState, environmentKey, ruleRef))
    } else {
        resolved
    }
}
