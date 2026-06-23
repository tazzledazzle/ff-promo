package com.ffpromo.db

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.transaction

/**
 * Flyway-first database bootstrap: migrate schema, then connect Exposed via HikariCP.
 *
 * Schema changes for the Kotlin backend go through Flyway only (`db/migration/V*.sql`).
 */
object DatabaseFactory {
    private var dataSource: HikariDataSource? = null
    private var database: Database? = null

    data class ConnectionInfo(
        val jdbcUrl: String,
        val username: String,
        val password: String,
    )

    fun connectFromDatabaseUrl(databaseUrl: String) {
        val parsed = parseDatabaseUrl(databaseUrl)
        connect(parsed.jdbcUrl, parsed.username, parsed.password)
    }

    fun parseDatabaseUrl(url: String): ConnectionInfo {
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

    fun connect(jdbcUrl: String, user: String, password: String): Database {
        Flyway.configure()
            .dataSource(jdbcUrl, user, password)
            .locations("classpath:db/migration")
            .load()
            .migrate()

        val hikari = HikariDataSource(
            HikariConfig().apply {
                this.jdbcUrl = jdbcUrl
                this.username = user
                this.password = password
                driverClassName = "org.postgresql.Driver"
                maximumPoolSize = 5
            },
        )

        closeQuietly()

        dataSource = hikari
        database = Database.connect(hikari)
        return database!!
    }

    fun close() {
        closeQuietly()
        database = null
    }

    fun <T> withTransaction(block: () -> T): T {
        val db = database ?: error("DatabaseFactory.connect must be called before withTransaction")
        return transaction(db) { block() }
    }

    private fun closeQuietly() {
        dataSource?.close()
        dataSource = null
    }
}
