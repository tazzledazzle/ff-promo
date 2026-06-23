package com.ffpromo.ldadapter.read

import com.ffpromo.contracts.FlagEnvironmentState
import com.ffpromo.contracts.FlagRule
import com.ffpromo.contracts.FlagState
import com.ffpromo.contracts.FlagVariation
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

fun mapLdFlagToFlagState(
    rawLdFlag: JsonObject,
    projectKey: String,
    flagKey: String,
): FlagState {
    val environments = mutableMapOf<String, FlagEnvironmentState>()

    rawLdFlag["environments"]?.jsonObject?.forEach { (envKey, envElement) ->
        val env = envElement.jsonObject
        environments[envKey] = FlagEnvironmentState(
            on = env["on"]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: false,
            rules = (env["rules"]?.jsonArray ?: JsonArray(emptyList())).map { ruleElement ->
                val rule = ruleElement.jsonObject
                FlagRule(
                    id = rule.stringField("_id", "id"),
                    description = rule["description"]?.jsonPrimitive?.content,
                    clauses = rule["clauses"]?.jsonArray?.toList() ?: emptyList(),
                    variationOrRollout = rule["variationOrRollout"],
                )
            },
            fallthrough = env["fallthrough"],
            offVariation = env["offVariation"]?.jsonPrimitive?.content?.toIntOrNull(),
            targets = env["targets"]?.jsonArray?.toList(),
        )
    }

    val variations = (rawLdFlag["variations"]?.jsonArray ?: JsonArray(emptyList())).map { variationElement ->
        val variation = variationElement.jsonObject
        FlagVariation(
            id = variation.stringField("_id", "id"),
            name = variation["name"]?.jsonPrimitive?.content,
            value = variation["value"] ?: JsonNull,
        )
    }

    return FlagState(
        projectKey = projectKey,
        flagKey = flagKey,
        variations = variations,
        environments = environments,
    )
}

private fun JsonObject.stringField(vararg keys: String): String {
    for (key in keys) {
        this[key]?.jsonPrimitive?.content?.let { return it }
    }
    return ""
}
