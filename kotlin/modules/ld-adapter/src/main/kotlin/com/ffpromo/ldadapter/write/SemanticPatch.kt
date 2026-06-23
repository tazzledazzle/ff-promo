package com.ffpromo.ldadapter.write

import com.ffpromo.contracts.RolloutIntent
import com.ffpromo.contracts.SemanticPatchInstruction
import com.ffpromo.contracts.TargetingIntent
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

data class ResolvedRolloutIds(
    val treatmentVariationId: String,
    val controlVariationId: String,
    val ruleId: String? = null,
)

fun buildRolloutWeights(
    treatmentThousandths: Int,
    treatmentVariationId: String,
    controlVariationId: String,
): Map<String, Int> {
    require(treatmentThousandths in 0..100_000) {
        "treatmentThousandths must be between 0 and 100000"
    }
    val controlThousandths = 100_000 - treatmentThousandths
    val weights = mapOf(
        treatmentVariationId to treatmentThousandths,
        controlVariationId to controlThousandths,
    )
    val sum = weights.values.sum()
    check(sum == 100_000) { "rollout weights must sum to 100000, got $sum" }
    return weights
}

private fun rolloutInstruction(
    rollout: RolloutIntent,
    resolved: ResolvedRolloutIds,
): SemanticPatchInstruction {
    val rolloutWeights = buildRolloutWeights(
        rollout.treatmentPercentThousandths,
        resolved.treatmentVariationId,
        resolved.controlVariationId,
    )

    return if (rollout.mode == "rule") {
        val ruleId = resolved.ruleId ?: error("ruleId required when rollout.mode is rule")
        SemanticPatchInstruction.UpdateRuleVariationOrRollout(
            ruleId = ruleId,
            rolloutWeights = rolloutWeights,
            rolloutBucketBy = rollout.rolloutBucketBy,
            rolloutContextKind = rollout.rolloutContextKind,
        )
    } else {
        SemanticPatchInstruction.UpdateFallthroughVariationOrRollout(
            rolloutWeights = rolloutWeights,
            rolloutBucketBy = rollout.rolloutBucketBy,
            rolloutContextKind = rollout.rolloutContextKind,
        )
    }
}

fun buildTargetingPatchBody(
    intent: TargetingIntent,
    resolved: ResolvedRolloutIds? = null,
): JsonObject {
    val instructions = buildJsonArray {
        when (intent.turnOn) {
            false -> add(buildJsonObject { put("kind", JsonPrimitive("turnFlagOff")) })
            null, true -> add(buildJsonObject { put("kind", JsonPrimitive("turnFlagOn")) })
        }

        val rollout = intent.rollout
        if (rollout != null) {
            requireNotNull(resolved) { "resolved variation IDs required when rollout is present" }
            add(instructionToJson(rolloutInstruction(rollout, resolved)))
        }
    }

    instructions.forEach { element ->
        val kind = element.jsonObject["kind"]?.jsonPrimitive?.content
        if (kind == "updatePercentageRollout") {
            error("updatePercentageRollout is not a valid LD instruction")
        }
    }

    return buildJsonObject {
        put("environmentKey", JsonPrimitive(intent.environmentKey))
        intent.comment?.let { put("comment", JsonPrimitive(it)) }
        put("instructions", instructions)
    }
}

private fun instructionToJson(instruction: SemanticPatchInstruction): JsonObject =
    when (instruction) {
        SemanticPatchInstruction.TurnFlagOn -> buildJsonObject { put("kind", JsonPrimitive("turnFlagOn")) }
        SemanticPatchInstruction.TurnFlagOff -> buildJsonObject { put("kind", JsonPrimitive("turnFlagOff")) }
        is SemanticPatchInstruction.UpdateFallthroughVariationOrRollout -> buildJsonObject {
            put("kind", JsonPrimitive("updateFallthroughVariationOrRollout"))
            put("rolloutWeights", weightsToJson(instruction.rolloutWeights))
            put("rolloutBucketBy", JsonPrimitive(instruction.rolloutBucketBy))
            put("rolloutContextKind", JsonPrimitive(instruction.rolloutContextKind))
        }
        is SemanticPatchInstruction.UpdateRuleVariationOrRollout -> buildJsonObject {
            put("kind", JsonPrimitive("updateRuleVariationOrRollout"))
            put("ruleId", JsonPrimitive(instruction.ruleId))
            put("rolloutWeights", weightsToJson(instruction.rolloutWeights))
            put("rolloutBucketBy", JsonPrimitive(instruction.rolloutBucketBy))
            put("rolloutContextKind", JsonPrimitive(instruction.rolloutContextKind))
        }
    }

private fun weightsToJson(weights: Map<String, Int>) = buildJsonObject {
    weights.forEach { (key, value) -> put(key, JsonPrimitive(value)) }
}
