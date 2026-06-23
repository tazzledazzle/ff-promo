package com.ffpromo.ldadapter.read

import com.ffpromo.contracts.FlagEnvironmentState
import com.ffpromo.contracts.FlagState
import com.ffpromo.contracts.GetFlagStateInput
import com.ffpromo.ldadapter.client.LaunchDarklyRawClient
import com.ffpromo.ldadapter.client.LdApiClient
import com.ffpromo.ldadapter.errors.LdApiError

data class GetFlagStateDeps(
    val client: LaunchDarklyRawClient,
)

fun getEnvironmentState(
    flagState: FlagState,
    environmentKey: String,
): FlagEnvironmentState {
    val env = flagState.environments[environmentKey]
        ?: throw LdApiError(
            message = "Environment not found in flag state: $environmentKey",
            status = 404,
            context = mapOf(
                "projectKey" to flagState.projectKey,
                "flagKey" to flagState.flagKey,
                "environmentKey" to environmentKey,
            ),
        )
    return env
}

suspend fun getFlagState(deps: GetFlagStateDeps, input: GetFlagStateInput): FlagState {
    val apiClient = LdApiClient(deps.client)
    val raw = apiClient.getFeatureFlag(input.projectKey, input.flagKey)
    val flagState = mapLdFlagToFlagState(raw, input.projectKey, input.flagKey)
    getEnvironmentState(flagState, input.environmentKey)
    return flagState
}
