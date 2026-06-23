package com.ffpromo.ldadapter.provider

import com.ffpromo.contracts.ApplyTargetingInput
import com.ffpromo.contracts.FlagState
import com.ffpromo.contracts.GetFlagStateInput

interface FlagProvider {
    suspend fun getFlagState(input: GetFlagStateInput): FlagState
    suspend fun applyTargeting(input: ApplyTargetingInput): FlagState
}
