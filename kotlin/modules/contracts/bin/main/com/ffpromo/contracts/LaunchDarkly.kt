package com.ffpromo.contracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator
import kotlinx.serialization.json.JsonElement

@Serializable
data class FlagVariation(
    val id: String,
    val name: String? = null,
    val value: JsonElement,
)

@Serializable
data class FlagRule(
    val id: String,
    val description: String? = null,
    val clauses: List<JsonElement> = emptyList(),
    val variationOrRollout: JsonElement? = null,
)

@Serializable
data class FlagEnvironmentState(
    val on: Boolean,
    val rules: List<FlagRule> = emptyList(),
    val fallthrough: JsonElement? = null,
    val offVariation: Int? = null,
    val targets: List<JsonElement>? = null,
)

@Serializable
data class FlagState(
    val projectKey: String,
    val flagKey: String,
    val variations: List<FlagVariation>,
    val environments: Map<String, FlagEnvironmentState>,
)

@Serializable
@JsonClassDiscriminator("by")
sealed class VariationRef {
    @Serializable
    @SerialName("id")
    data class ById(val id: String) : VariationRef()

    @Serializable
    @SerialName("name")
    data class ByName(val name: String) : VariationRef()

    @Serializable
    @SerialName("value")
    data class ByValue(val value: JsonElement) : VariationRef()
}

@Serializable
@JsonClassDiscriminator("by")
sealed class RuleRef {
    @Serializable
    @SerialName("id")
    data class ById(val id: String) : RuleRef()

    @Serializable
    @SerialName("description")
    data class ByDescription(val description: String) : RuleRef()
}

@Serializable
data class RolloutIntent(
    val mode: String = "fallthrough",
    val treatmentVariationRef: VariationRef,
    val controlVariationRef: VariationRef,
    val treatmentPercentThousandths: Int,
    val rolloutContextKind: String,
    val rolloutBucketBy: String,
    val ruleRef: RuleRef? = null,
)

@Serializable
@JsonClassDiscriminator("kind")
sealed class SemanticPatchInstruction {
    @Serializable
    @SerialName("turnFlagOn")
    data object TurnFlagOn : SemanticPatchInstruction()

    @Serializable
    @SerialName("turnFlagOff")
    data object TurnFlagOff : SemanticPatchInstruction()

    @Serializable
    @SerialName("updateFallthroughVariationOrRollout")
    data class UpdateFallthroughVariationOrRollout(
        val rolloutWeights: Map<String, Int>,
        val rolloutBucketBy: String,
        val rolloutContextKind: String,
    ) : SemanticPatchInstruction()

    @Serializable
    @SerialName("updateRuleVariationOrRollout")
    data class UpdateRuleVariationOrRollout(
        val ruleId: String,
        val rolloutWeights: Map<String, Int>,
        val rolloutBucketBy: String,
        val rolloutContextKind: String,
    ) : SemanticPatchInstruction()
}

@Serializable
data class TargetingIntent(
    val environmentKey: String,
    val comment: String? = null,
    val turnOn: Boolean? = null,
    val rollout: RolloutIntent? = null,
)

@Serializable
data class GetFlagStateInput(
    val projectKey: String,
    val flagKey: String,
    val environmentKey: String,
)

@Serializable
data class ApplyTargetingInput(
    val projectKey: String,
    val flagKey: String,
    val intent: TargetingIntent,
)

@Serializable
data class LaunchDarklyClientConfig(
    val accessToken: String,
    val baseUrl: String? = null,
    val apiVersion: String? = null,
)
