package com.ffpromo.db

import com.ffpromo.contracts.MetricType
import com.ffpromo.contracts.PipelineCreateInput
import com.ffpromo.contracts.StageEnvironment
import com.ffpromo.db.fixtures.standardStages
import com.ffpromo.db.repositories.PipelineRepository
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import java.util.UUID

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PipelineRepositoryIntegrationTest {
    private lateinit var repo: PipelineRepository

    @BeforeAll
    fun setUp() {
        TestDatabase.start()
        repo = PipelineRepository()
    }

    @AfterAll
    fun tearDown() {
        TestDatabase.stop()
    }

    @Test
    fun `persists pipeline with 3 stages and gate policies, findById returns nested stages ordered by orderIndex`() {
        val created = repo.create(
            PipelineCreateInput(
                name = "dev-staging-prod-${UUID.randomUUID()}",
                flagKey = "checkout-v2",
                projectKey = "default",
                stages = standardStages("checkout-api"),
            ),
        )

        assertEquals(3, created.stages.size)

        val loaded = repo.findById(created.id)
        assertNotNull(loaded)
        assertEquals(
            listOf(StageEnvironment.dev, StageEnvironment.staging, StageEnvironment.prod),
            loaded!!.stages.map { it.environment },
        )
        assertEquals(2, loaded.stages[0].gatePolicies.size)
        assertEquals(MetricType.error_rate, loaded.stages[0].gatePolicies[0].metricType)
    }

    @Test
    fun `findByFlagKey returns pipelines matching flagKey`() {
        val flagKey = "unique-flag-key-${UUID.randomUUID()}"
        repo.create(
            PipelineCreateInput(
                name = "flag-key-lookup-${UUID.randomUUID()}",
                flagKey = flagKey,
                projectKey = "default",
                stages = standardStages().take(1),
            ),
        )

        val results = repo.findByFlagKey(flagKey)
        assertEquals(1, results.size)
        assertTrue(results.all { it.flagKey == flagKey })
    }

    @Test
    fun `deactivate sets isActive false`() {
        val created = repo.create(
            PipelineCreateInput(
                name = "deactivate-${UUID.randomUUID()}",
                flagKey = "deactivate-flag",
                projectKey = "default",
                stages = standardStages(),
            ),
        )

        val deactivated = repo.deactivate(created.id)
        assertFalse(deactivated.isActive)
        assertEquals(3, deactivated.stages.size)
    }

    @Test
    fun `listAll includes deactivated pipelines`() {
        val created = repo.create(
            PipelineCreateInput(
                name = "list-all-${UUID.randomUUID()}",
                flagKey = "list-all-${UUID.randomUUID()}",
                projectKey = "default",
                stages = standardStages(),
            ),
        )
        repo.deactivate(created.id)

        val all = repo.listAll()
        val item = all.find { it.id == created.id }
        assertNotNull(item)
        assertFalse(item!!.isActive)
    }

    @Test
    fun `resolveNextVersion increments after second create with same name`() {
        val name = "version-bump-${UUID.randomUUID()}"

        val first = repo.create(
            PipelineCreateInput(
                name = name,
                flagKey = "v1-${UUID.randomUUID()}",
                projectKey = "default",
                stages = standardStages(),
            ),
        )
        assertEquals(1, first.version)

        val second = repo.create(
            PipelineCreateInput(
                name = name,
                flagKey = "v2-${UUID.randomUUID()}",
                projectKey = "default",
                stages = standardStages(),
            ),
        )
        assertEquals(2, second.version)

        assertEquals(3, repo.resolveNextVersion(name))
    }
}
