package com.ffpromo.ldadapter.resolve

import com.ffpromo.contracts.FlagState
import com.ffpromo.contracts.VariationRef
import com.ffpromo.ldadapter.errors.UnresolvedVariationError
import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = true }

private fun valuesEqual(a: kotlinx.serialization.json.JsonElement, b: kotlinx.serialization.json.JsonElement): Boolean =
    json.encodeToString(kotlinx.serialization.json.JsonElement.serializer(), a) ==
        json.encodeToString(kotlinx.serialization.json.JsonElement.serializer(), b)

fun resolveVariationId(flagState: FlagState, ref: VariationRef): String {
    val matches = flagState.variations.filter { variation ->
        when (ref) {
            is VariationRef.ById -> variation.id == ref.id
            is VariationRef.ByName -> variation.name == ref.name
            is VariationRef.ByValue -> valuesEqual(variation.value, ref.value)
        }
    }

    if (matches.size != 1) {
        throw UnresolvedVariationError(
            message = "Expected exactly one variation match, found ${matches.size}",
            context = mapOf(
                "ref" to ref,
                "flagKey" to flagState.flagKey,
                "projectKey" to flagState.projectKey,
            ),
        )
    }

    val match = matches.first()
    if (match.id.isEmpty()) {
        throw UnresolvedVariationError(
            message = "Matched variation is missing id",
            context = mapOf("ref" to ref, "flagKey" to flagState.flagKey),
        )
    }

    return match.id
}
