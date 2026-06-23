package com.ffpromo.ldadapter.write

import com.ffpromo.contracts.RolloutIntent
import com.ffpromo.contracts.TargetingIntent
import com.ffpromo.contracts.VariationRef
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class SemanticPatchBuilderTest {
    @Test
    fun `buildRolloutWeights returns weights summing to 100000`() {
        val weights = buildRolloutWeights(10_000, "var-on", "var-off")
        assertEquals(mapOf("var-on" to 10_000, "var-off" to 90_000), weights)
        assertEquals(100_000, weights.values.sum())
    }

    @Test
    fun `buildTargetingPatchBody for fallthrough emits turnFlagOn and updateFallthroughVariationOrRollout`() {
        val body = buildTargetingPatchBody(
            TargetingIntent(
                environmentKey = "production",
                rollout = RolloutIntent(
                    mode = "fallthrough",
                    treatmentVariationRef = VariationRef.ById("var-on"),
                    controlVariationRef = VariationRef.ById("var-off"),
                    treatmentPercentThousandths = 10_000,
                    rolloutContextKind = "user",
                    rolloutBucketBy = "user",
                ),
            ),
            ResolvedRolloutIds(
                treatmentVariationId = "var-on",
                controlVariationId = "var-off",
            ),
        )

        val kinds = body["instructions"]!!.toString()
        assert(kinds.contains("turnFlagOn"))
        assert(kinds.contains("updateFallthroughVariationOrRollout"))
        assert(kinds.contains("rolloutBucketBy"))
        assert(kinds.contains("user"))
    }

    @Test
    fun `never includes updatePercentageRollout instruction kind`() {
        val body = buildTargetingPatchBody(
            TargetingIntent(
                environmentKey = "production",
                rollout = RolloutIntent(
                    mode = "fallthrough",
                    treatmentVariationRef = VariationRef.ById("a"),
                    controlVariationRef = VariationRef.ById("b"),
                    treatmentPercentThousandths = 50_000,
                    rolloutContextKind = "user",
                    rolloutBucketBy = "user",
                ),
            ),
            ResolvedRolloutIds(treatmentVariationId = "a", controlVariationId = "b"),
        )

        assertFalse(body.toString().contains("updatePercentageRollout"))
    }
}
