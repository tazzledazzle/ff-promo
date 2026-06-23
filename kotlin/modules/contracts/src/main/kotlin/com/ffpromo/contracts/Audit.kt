package com.ffpromo.contracts

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class AuditEventInput(
    val promotionRunId: String,
    val action: AuditAction,
    val actorType: ActorType,
    val actorId: String,
    val displayName: String? = null,
    val gateResultId: String? = null,
    val metadata: Map<String, JsonElement>? = null,
)
