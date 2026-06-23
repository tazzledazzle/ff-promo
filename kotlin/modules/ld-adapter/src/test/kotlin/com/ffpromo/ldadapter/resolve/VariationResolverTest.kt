package com.ffpromo.ldadapter.resolve

import com.ffpromo.contracts.FlagState
import com.ffpromo.contracts.FlagVariation
import com.ffpromo.contracts.RuleRef
import com.ffpromo.contracts.VariationRef
import com.ffpromo.ldadapter.errors.UnresolvedRuleError
import com.ffpromo.ldadapter.errors.UnresolvedVariationError
import com.ffpromo.ldadapter.read.mapLdFlagToFlagState
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class VariationResolverTest {
    private val json = Json { ignoreUnknownKeys = true }

    private val flagState = mapLdFlagToFlagState(
        json.parseToJsonElement(
            javaClass.getResource("/fixtures/flag-boolean.json")!!.readText(),
        ).jsonObject,
        "default",
        "sample-feature",
    )

    @Test
    fun `resolves by value when exactly one match`() {
        assertEquals(
            "var-on",
            resolveVariationId(flagState, VariationRef.ByValue(JsonPrimitive(true))),
        )
    }

    @Test
    fun `resolves by name and by id`() {
        assertEquals("var-off", resolveVariationId(flagState, VariationRef.ByName("Off")))
        assertEquals("var-on", resolveVariationId(flagState, VariationRef.ById("var-on")))
    }

    @Test
    fun `throws when zero matches`() {
        assertThrows<UnresolvedVariationError> {
            resolveVariationId(flagState, VariationRef.ByValue(JsonPrimitive("missing")))
        }
    }

    @Test
    fun `throws when ambiguous value match`() {
        val ambiguous = flagState.copy(
            variations = listOf(
                FlagVariation("a", value = JsonPrimitive(true)),
                FlagVariation("b", value = JsonPrimitive(true)),
            ),
        )
        assertThrows<UnresolvedVariationError> {
            resolveVariationId(ambiguous, VariationRef.ByValue(JsonPrimitive(true)))
        }
    }
}

class RuleResolverTest {
    private val json = Json { ignoreUnknownKeys = true }

    private val flagState = mapLdFlagToFlagState(
        json.parseToJsonElement(
            javaClass.getResource("/fixtures/flag-boolean.json")!!.readText(),
        ).jsonObject,
        "default",
        "sample-feature",
    )

    @Test
    fun `resolves rule by id from staging environment`() {
        assertEquals(
            "rule-staging-1",
            resolveRuleId(flagState, "staging", RuleRef.ById("rule-staging-1")),
        )
    }

    @Test
    fun `throws when staging rule id used with production environmentKey`() {
        assertThrows<UnresolvedRuleError> {
            resolveRuleId(flagState, "production", RuleRef.ById("rule-staging-1"))
        }
    }
}
