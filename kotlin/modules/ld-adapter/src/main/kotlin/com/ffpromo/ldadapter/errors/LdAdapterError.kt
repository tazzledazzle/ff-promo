package com.ffpromo.ldadapter.errors

open class LdAdapterError(
    message: String,
    open val context: Map<String, Any?>? = null,
) : Exception(message)

class UnresolvedVariationError(
    message: String,
    context: Map<String, Any?>? = null,
) : LdAdapterError(message, context)

class UnresolvedRuleError(
    message: String,
    context: Map<String, Any?>? = null,
) : LdAdapterError(message, context)

class LdRateLimitError(
    message: String,
    val retryAfterMs: Long? = null,
    context: Map<String, Any?>? = null,
) : LdAdapterError(message, context)

class LdApiError(
    message: String,
    val status: Int,
    val body: Any? = null,
    context: Map<String, Any?>? = null,
) : LdAdapterError(message, context)

class ApprovalRequiredError(
    message: String,
    val environmentKey: String? = null,
    context: Map<String, Any?>? = null,
) : LdAdapterError(message, context)

class HttpResponseError(
    message: String,
    val status: Int,
    val responseBody: Any? = null,
    val headers: Map<String, String> = emptyMap(),
) : Exception(message)
