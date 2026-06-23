package com.ffpromo.telemetry.errors

open class TelemetryAdapterError(
    message: String,
    open val context: Map<String, Any?>? = null,
    cause: Throwable? = null,
) : Exception(message, cause)

class TelemetryApiError(
    message: String,
    val status: Int,
    val body: Any? = null,
    context: Map<String, Any?>? = null,
) : TelemetryAdapterError(message, context)

class UnsupportedMetricTypeError(
    message: String,
    val metricType: String,
    context: Map<String, Any?>? = null,
) : TelemetryAdapterError(message, context)
