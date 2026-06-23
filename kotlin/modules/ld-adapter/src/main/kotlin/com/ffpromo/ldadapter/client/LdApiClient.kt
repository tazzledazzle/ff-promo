package com.ffpromo.ldadapter.client

import com.ffpromo.contracts.LaunchDarklyClientConfig
import com.launchdarkly.api.ApiClient
import com.launchdarkly.api.api.FeatureFlagsApi
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

const val SEMANTIC_PATCH_CONTENT_TYPE =
    "application/json; domain-model=launchdarkly.semanticpatch"

const val DEFAULT_LD_BASE_URL = "https://app.launchdarkly.com"
const val DEFAULT_LD_API_VERSION = "20240415"

data class ResolvedLaunchDarklyConfig(
    val accessToken: String,
    val baseUrl: String,
    val apiVersion: String,
)

data class LaunchDarklyRawClient(
    val flagsApi: FeatureFlagsApi,
    val config: ResolvedLaunchDarklyConfig,
    val httpClient: OkHttpClient,
)

fun createLaunchDarklyClient(configInput: LaunchDarklyClientConfig): LaunchDarklyRawClient {
    val baseUrl = (configInput.baseUrl ?: System.getenv("LD_BASE_URL") ?: DEFAULT_LD_BASE_URL)
        .trimEnd('/')
    val apiVersion = configInput.apiVersion ?: DEFAULT_LD_API_VERSION

    val apiClient = ApiClient()
    apiClient.basePath = baseUrl
    apiClient.setApiKey(configInput.accessToken)
    apiClient.addDefaultHeader("LD-API-Version", apiVersion)

    val httpClient = apiClient.httpClient ?: OkHttpClient()

    return LaunchDarklyRawClient(
        flagsApi = FeatureFlagsApi(apiClient),
        config = ResolvedLaunchDarklyConfig(
            accessToken = configInput.accessToken,
            baseUrl = baseUrl,
            apiVersion = apiVersion,
        ),
        httpClient = httpClient,
    )
}

private fun encodePathSegment(value: String): String =
    URLEncoder.encode(value, StandardCharsets.UTF_8)

private val json = Json { ignoreUnknownKeys = true }

class LdApiClient(val rawClient: LaunchDarklyRawClient) {
    suspend fun getFeatureFlag(projectKey: String, flagKey: String): JsonObject =
        withContext(Dispatchers.IO) {
            val url =
                "${rawClient.config.baseUrl}/api/v2/flags/${encodePathSegment(projectKey)}/${encodePathSegment(flagKey)}"
            val request = Request.Builder()
                .url(url)
                .header("Authorization", rawClient.config.accessToken)
                .header("LD-API-Version", rawClient.config.apiVersion)
                .header("Accept", "application/json")
                .get()
                .build()

            rawClient.httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw com.ffpromo.ldadapter.errors.HttpResponseError(
                        message = "LaunchDarkly GET failed with status ${response.code}",
                        status = response.code,
                        responseBody = body.ifEmpty { null },
                        headers = response.headers.toMultimap().mapValues { it.value.firstOrNull().orEmpty() },
                    )
                }
                json.parseToJsonElement(body).jsonObject
            }
        }

    suspend fun patchFeatureFlag(
        projectKey: String,
        flagKey: String,
        body: JsonObject,
    ): JsonObject = withContext(Dispatchers.IO) {
        val url =
            "${rawClient.config.baseUrl}/api/v2/flags/${encodePathSegment(projectKey)}/${encodePathSegment(flagKey)}"
        val requestBody = json.encodeToString(JsonObject.serializer(), body)
            .toRequestBody(SEMANTIC_PATCH_CONTENT_TYPE.toMediaType())

        val request = Request.Builder()
            .url(url)
            .header("Authorization", rawClient.config.accessToken)
            .header("LD-API-Version", rawClient.config.apiVersion)
            .header("Content-Type", SEMANTIC_PATCH_CONTENT_TYPE)
            .header("Accept", "application/json")
            .patch(requestBody)
            .build()

        rawClient.httpClient.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            val headers = response.headers.toMultimap().mapValues { it.value.firstOrNull().orEmpty() }
            if (!response.isSuccessful) {
                throw com.ffpromo.ldadapter.errors.HttpResponseError(
                    message = "LaunchDarkly PATCH failed with status ${response.code}",
                    status = response.code,
                    responseBody = responseBody.ifEmpty { null },
                    headers = headers,
                )
            }
            if (responseBody.isEmpty()) {
                JsonObject(emptyMap())
            } else {
                json.parseToJsonElement(responseBody).jsonObject
            }
        }
    }
}

fun createLdApiClient(config: LaunchDarklyClientConfig): LdApiClient =
    LdApiClient(createLaunchDarklyClient(config))
