package com.ffpromo.ldadapter.provider

import com.ffpromo.contracts.ApplyTargetingInput
import com.ffpromo.contracts.GetFlagStateInput
import com.ffpromo.contracts.LaunchDarklyClientConfig
import com.ffpromo.ldadapter.client.LaunchDarklyRawClient
import com.ffpromo.ldadapter.client.RateLimitedLdClient
import com.ffpromo.ldadapter.client.createLaunchDarklyClient
import com.ffpromo.ldadapter.client.createRateLimitedLdClient
import com.ffpromo.ldadapter.read.GetFlagStateDeps
import com.ffpromo.ldadapter.read.getFlagState
import com.ffpromo.ldadapter.write.ApplyTargetingDeps
import com.ffpromo.ldadapter.write.applyTargeting

class LaunchDarklyProvider(
    private val rawClient: LaunchDarklyRawClient,
    private val rateLimitedClient: RateLimitedLdClient,
) : FlagProvider {
    override suspend fun getFlagState(input: GetFlagStateInput) =
        rateLimitedClient.schedule {
            getFlagState(GetFlagStateDeps(rawClient), input)
        }

    override suspend fun applyTargeting(input: ApplyTargetingInput) =
        applyTargeting(ApplyTargetingDeps(rateLimitedClient), input)
}

fun createLaunchDarklyProvider(config: LaunchDarklyClientConfig): LaunchDarklyProvider {
    val rawClient = createLaunchDarklyClient(config)
    val rateLimitedClient = createRateLimitedLdClient(rawClient)
    return LaunchDarklyProvider(rawClient, rateLimitedClient)
}
