package com.ffpromo.db

import org.testcontainers.containers.PostgreSQLContainer

/**
 * Test database harness mirroring v1 [packages.db setup.ts].
 *
 * Prefer a dedicated database (`ffpromo_kotlin`) for local dev to avoid Prisma/Flyway
 * history conflicts when not using Testcontainers. Set `SKIP_TESTCONTAINERS=1` and
 * `DATABASE_URL=postgresql://user:pass@localhost:5432/ffpromo_kotlin` to reuse compose Postgres.
 */
object TestDatabase {
    private var container: PostgreSQLContainer<*>? = null
    private var jdbcUrl: String? = null
    private var username: String? = null
    private var password: String? = null

    fun isTestcontainersSkipped(): Boolean = System.getenv("SKIP_TESTCONTAINERS") == "1"

    data class ConnectionInfo(
        val jdbcUrl: String,
        val username: String,
        val password: String,
    )

    fun start(): ConnectionInfo {
        if (isTestcontainersSkipped()) {
            val url = System.getenv("DATABASE_URL")
                ?: error("SKIP_TESTCONTAINERS=1 requires DATABASE_URL to be set")
            val parsed = parseJdbcUrl(url)
            jdbcUrl = parsed.jdbcUrl
            username = parsed.username
            password = parsed.password
        } else {
            val postgres = PostgreSQLContainer("postgres:16-alpine")
                .withDatabaseName("ffpromo")
                .withUsername("ffpromo")
                .withPassword("ffpromo")
            postgres.start()
            container = postgres
            jdbcUrl = postgres.jdbcUrl
            username = postgres.username
            password = postgres.password
        }

        DatabaseFactory.connect(jdbcUrl!!, username!!, password!!)

        return ConnectionInfo(jdbcUrl!!, username!!, password!!)
    }

    fun stop() {
        DatabaseFactory.close()
        container?.stop()
        container = null
        jdbcUrl = null
        username = null
        password = null
    }

    private fun parseJdbcUrl(url: String): ConnectionInfo {
        // postgresql://user:pass@host:port/dbname
        val withoutScheme = url.removePrefix("postgresql://").removePrefix("postgres://")
        val atIndex = withoutScheme.lastIndexOf('@')
        require(atIndex > 0) { "Invalid DATABASE_URL: missing credentials" }

        val credentials = withoutScheme.substring(0, atIndex)
        val hostAndDb = withoutScheme.substring(atIndex + 1)
        val colonIndex = credentials.indexOf(':')
        require(colonIndex > 0) { "Invalid DATABASE_URL: missing password separator" }

        val user = credentials.substring(0, colonIndex)
        val pass = credentials.substring(colonIndex + 1)
        val jdbc = "jdbc:postgresql://$hostAndDb"

        return ConnectionInfo(jdbc, user, pass)
    }
}
