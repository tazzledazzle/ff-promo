package com.ffpromo.ldadapter.resolve

import com.ffpromo.contracts.FlagState
import com.ffpromo.contracts.RuleRef
import com.ffpromo.ldadapter.errors.UnresolvedRuleError

fun resolveRuleId(
    flagState: FlagState,
    environmentKey: String,
    ref: RuleRef,
): String {
    val env = flagState.environments[environmentKey]
        ?: throw UnresolvedRuleError(
            message = "Environment not found for rule resolution: $environmentKey",
            context = mapOf(
                "environmentKey" to environmentKey,
                "flagKey" to flagState.flagKey,
                "ref" to ref,
            ),
        )

    val matches = env.rules.filter { rule ->
        when (ref) {
            is RuleRef.ById -> rule.id == ref.id
            is RuleRef.ByDescription -> rule.description == ref.description
        }
    }

    if (matches.size != 1) {
        throw UnresolvedRuleError(
            message = "Expected exactly one rule match in $environmentKey, found ${matches.size}",
            context = mapOf(
                "environmentKey" to environmentKey,
                "ref" to ref,
                "flagKey" to flagState.flagKey,
            ),
        )
    }

    val match = matches.first()
    if (match.id.isEmpty()) {
        throw UnresolvedRuleError(
            message = "Matched rule is missing id",
            context = mapOf("environmentKey" to environmentKey, "ref" to ref),
        )
    }

    return match.id
}
