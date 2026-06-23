package com.ffpromo.telemetry.query

import com.ffpromo.telemetry.client.PrometheusInstantQueryData
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

sealed class ParseResult {
    data class Ok(val value: Double) : ParseResult()
    data class Fail(val reason: ParseFailReason) : ParseResult()
}

enum class ParseFailReason {
    no_data,
    non_finite_value,
}

private fun parseSampleValue(valueString: String): ParseResult {
    if (valueString == "NaN" || valueString == "+Inf" || valueString == "-Inf") {
        return ParseResult.Fail(ParseFailReason.non_finite_value)
    }
    val value = valueString.toDoubleOrNull()
    if (value == null || !value.isFinite()) {
        return ParseResult.Fail(ParseFailReason.non_finite_value)
    }
    return ParseResult.Ok(value)
}

private fun parseVectorResult(result: JsonElement): ParseResult {
    val array = result as? JsonArray ?: return ParseResult.Fail(ParseFailReason.no_data)
    if (array.isEmpty()) {
        return ParseResult.Fail(ParseFailReason.no_data)
    }
    val first = array.first() as? JsonObject ?: return ParseResult.Fail(ParseFailReason.no_data)
    val valueTuple = first["value"]?.jsonArray ?: return ParseResult.Fail(ParseFailReason.no_data)
    if (valueTuple.size < 2) {
        return ParseResult.Fail(ParseFailReason.no_data)
    }
    return parseSampleValue(valueTuple[1].jsonPrimitive.content)
}

private fun parseScalarResult(result: JsonElement): ParseResult {
    val array = result as? JsonArray ?: return ParseResult.Fail(ParseFailReason.no_data)
    if (array.size < 2) {
        return ParseResult.Fail(ParseFailReason.no_data)
    }
    return parseSampleValue(array[1].jsonPrimitive.content)
}

fun parseInstantQueryResult(data: PrometheusInstantQueryData): ParseResult =
    when (data.resultType) {
        "vector" -> parseVectorResult(data.result)
        "scalar" -> parseScalarResult(data.result)
        else -> ParseResult.Fail(ParseFailReason.no_data)
    }
