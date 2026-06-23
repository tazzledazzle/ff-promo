package com.ffpromo.contracts

import kotlinx.serialization.Serializable

@Serializable
data class GatePolicyInput(
    val metricType: MetricType,
    val threshold: Double,
    val serviceName: String,
    val comparisonMode: String? = null,
    val windowSeconds: Int? = null,
    val minSampleSize: Int? = null,
)

@Serializable
data class GatePolicyResponse(
    val id: String,
    val metricType: MetricType,
    val threshold: Double,
    val serviceName: String,
    val comparisonMode: String? = null,
    val windowSeconds: Int? = null,
    val minSampleSize: Int? = null,
)

@Serializable
data class StageInput(
    val orderIndex: Int,
    val environment: StageEnvironment,
    val displayName: String,
    val gatePolicies: List<GatePolicyInput>,
)

@Serializable
data class StageResponse(
    val id: String,
    val orderIndex: Int,
    val environment: StageEnvironment,
    val displayName: String,
    val gatePolicies: List<GatePolicyResponse>,
)

@Serializable
data class PipelineCreateInput(
    val name: String,
    val flagKey: String,
    val projectKey: String,
    val description: String? = null,
    val version: Int? = null,
    val stages: List<StageInput>,
)

@Serializable
data class Actor(
    val actorType: ActorType,
    val actorId: String,
    val displayName: String? = null,
)

@Serializable
data class PipelineCreateRequest(
    val name: String,
    val flagKey: String,
    val projectKey: String,
    val description: String? = null,
    val version: Int? = null,
    val stages: List<StageInput>,
    val actor: Actor,
)

@Serializable
data class PipelineUpdateRequest(
    val isActive: Boolean? = null,
    val description: String? = null,
    val actor: Actor,
)

@Serializable
data class PipelineResponse(
    val id: String,
    val name: String,
    val flagKey: String,
    val projectKey: String,
    val description: String? = null,
    val isActive: Boolean,
    val version: Int,
    val stages: List<StageResponse>,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)
