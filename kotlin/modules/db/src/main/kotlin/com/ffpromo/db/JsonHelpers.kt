package com.ffpromo.db

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

internal fun metadataToJsonObject(metadata: Map<String, JsonElement>?): JsonObject =
    JsonObject(metadata ?: emptyMap())

internal fun jsonObjectToMap(json: JsonObject): Map<String, JsonElement> = json.toMap()
