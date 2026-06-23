package com.ffpromo.telemetry.query

import com.ffpromo.telemetry.client.PrometheusInstantQueryData
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ParseResponseTest {
    private val json = Json { ignoreUnknownKeys = true }

    private fun loadFixture(name: String): PrometheusInstantQueryData {
        val element = json.parseToJsonElement(
            this::class.java.getResource("/fixtures/$name")!!.readText(),
        ).jsonObject
        return PrometheusInstantQueryData(
            resultType = element.getValue("resultType").jsonPrimitive.content,
            result = element.getValue("result"),
        )
    }

    @Test
    fun `parses vector with sample value`() {
        val result = parseInstantQueryResult(loadFixture("prometheus-vector-pass.json"))
        assertEquals(ParseResult.Ok(0.02), result)
    }

    @Test
    fun `parses scalar result type`() {
        val result = parseInstantQueryResult(loadFixture("prometheus-scalar-pass.json"))
        assertEquals(ParseResult.Ok(0.015), result)
    }

    @Test
    fun `fails closed on empty vector`() {
        val result = parseInstantQueryResult(loadFixture("prometheus-vector-empty.json"))
        assertEquals(ParseResult.Fail(ParseFailReason.no_data), result)
    }

    @Test
    fun `fails closed on NaN sample`() {
        val result = parseInstantQueryResult(loadFixture("prometheus-nan-value.json"))
        assertEquals(ParseResult.Fail(ParseFailReason.non_finite_value), result)
    }
}
