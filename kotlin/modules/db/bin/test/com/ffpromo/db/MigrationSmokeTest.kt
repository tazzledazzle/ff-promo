package com.ffpromo.db

import com.ffpromo.db.tables.Pipelines
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import java.time.Instant

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MigrationSmokeTest {
    private lateinit var connection: TestDatabase.ConnectionInfo

    @BeforeAll
    fun setUp() {
        connection = TestDatabase.start()
    }

    @AfterAll
    fun tearDown() {
        TestDatabase.stop()
    }

    @Test
    fun `Flyway applies V1 and V2 on empty Postgres without error`() {
        assertNotNull(connection.jdbcUrl)
    }

    @Test
    fun `can insert Pipeline row with generated id and read back flagKey`() {
        val pipelineId = IdGenerator.newId()
        val expectedFlagKey = "smoke-flag-${System.nanoTime()}"
        val now = Instant.now()

        DatabaseFactory.withTransaction {
            Pipelines.insert {
                it[id] = pipelineId
                it[name] = "smoke-pipeline"
                it[Pipelines.flagKey] = expectedFlagKey
                it[projectKey] = "smoke-project"
                it[version] = 1
                it[isActive] = true
                it[createdAt] = now
                it[updatedAt] = now
            }
        }

        val readFlagKey = DatabaseFactory.withTransaction {
            Pipelines
                .selectAll()
                .where { Pipelines.id eq pipelineId }
                .single()[Pipelines.flagKey]
        }

        assertEquals(expectedFlagKey, readFlagKey)
        assertTrue(pipelineId.length >= 20)
    }

    @Test
    fun `second DatabaseFactory connect on same DB is idempotent`() {
        DatabaseFactory.close()
        DatabaseFactory.connect(connection.jdbcUrl, connection.username, connection.password)

        val count = DatabaseFactory.withTransaction {
            Pipelines.selectAll().count()
        }

        assertTrue(count >= 1)
    }
}
