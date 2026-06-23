package com.ffpromo.db.repositories

import com.ffpromo.contracts.GatePolicyResponse
import com.ffpromo.contracts.MetricType
import com.ffpromo.contracts.PipelineCreateInput
import com.ffpromo.contracts.PipelineResponse
import com.ffpromo.contracts.StageEnvironment
import com.ffpromo.contracts.StageResponse
import com.ffpromo.db.DatabaseFactory
import com.ffpromo.db.IdGenerator
import com.ffpromo.db.models.PipelineSummary
import com.ffpromo.db.tables.GatePolicies
import com.ffpromo.db.tables.Pipelines
import com.ffpromo.db.tables.Stages
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.max
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.update
import java.time.Instant

class PipelineRepository {
    fun resolveNextVersion(name: String): Int = DatabaseFactory.withTransaction {
        val maxVersion = Pipelines
            .select(Pipelines.version.max())
            .where { Pipelines.name eq name }
            .singleOrNull()
            ?.get(Pipelines.version.max())
        ((maxVersion as Number?)?.toInt() ?: 0) + 1
    }

    fun create(input: PipelineCreateInput): PipelineResponse = DatabaseFactory.withTransaction {
        val now = Instant.now()
        val version = input.version ?: resolveNextVersionInTx(input.name)
        val pipelineId = IdGenerator.newId()

        Pipelines.insert {
            it[id] = pipelineId
            it[name] = input.name
            it[flagKey] = input.flagKey
            it[projectKey] = input.projectKey
            it[description] = input.description
            it[Pipelines.version] = version
            it[isActive] = true
            it[createdAt] = now
            it[updatedAt] = now
        }

        input.stages.forEach { stageInput ->
            val stageId = IdGenerator.newId()
            Stages.insert {
                it[id] = stageId
                it[Stages.pipelineId] = pipelineId
                it[orderIndex] = stageInput.orderIndex
                it[environment] = stageInput.environment.name
                it[displayName] = stageInput.displayName
            }

            stageInput.gatePolicies.forEach { policy ->
                GatePolicies.insert {
                    it[id] = IdGenerator.newId()
                    it[GatePolicies.stageId] = stageId
                    it[metricType] = policy.metricType.name
                    it[threshold] = policy.threshold
                    it[serviceName] = policy.serviceName
                    it[comparisonMode] = policy.comparisonMode ?: "absolute"
                    it[windowSeconds] = policy.windowSeconds ?: 300
                    it[minSampleSize] = policy.minSampleSize ?: 0
                }
            }
        }

        findByIdInTx(pipelineId) ?: error("Pipeline $pipelineId not found after insert")
    }

    fun findById(id: String): PipelineResponse? = DatabaseFactory.withTransaction {
        findByIdInTx(id)
    }

    fun findByFlagKey(flagKey: String): List<PipelineResponse> = DatabaseFactory.withTransaction {
        Pipelines
            .selectAll()
            .where { (Pipelines.flagKey eq flagKey) and (Pipelines.isActive eq true) }
            .map { it[Pipelines.id] }
            .mapNotNull { findByIdInTx(it) }
    }

    fun listAll(): List<PipelineSummary> = DatabaseFactory.withTransaction {
        Pipelines
            .selectAll()
            .orderBy(Pipelines.name to SortOrder.ASC)
            .map { row -> toSummary(row) }
    }

    fun deactivate(id: String): PipelineResponse = DatabaseFactory.withTransaction {
        val now = Instant.now()
        val updated = Pipelines.update({ Pipelines.id eq id }) {
            it[isActive] = false
            it[updatedAt] = now
        }
        check(updated == 1) { "Pipeline $id not found" }
        findByIdInTx(id) ?: error("Pipeline $id not found after deactivate")
    }

    private fun resolveNextVersionInTx(name: String): Int {
        val maxVersion = Pipelines
            .select(Pipelines.version.max())
            .where { Pipelines.name eq name }
            .singleOrNull()
            ?.get(Pipelines.version.max())
        return (maxVersion as Number?)?.toInt()?.plus(1) ?: 1
    }

    private fun findByIdInTx(id: String): PipelineResponse? {
        val pipelineRow = Pipelines
            .selectAll()
            .where { Pipelines.id eq id }
            .singleOrNull() ?: return null

        val stageRows = Stages
            .selectAll()
            .where { Stages.pipelineId eq id }
            .orderBy(Stages.orderIndex to SortOrder.ASC)
            .toList()

        val stages = stageRows.map { stageRow ->
            val stageId = stageRow[Stages.id]
            val policies = GatePolicies
                .selectAll()
                .where { GatePolicies.stageId eq stageId }
                .map { policyRow -> toGatePolicyResponse(policyRow) }

            StageResponse(
                id = stageId,
                orderIndex = stageRow[Stages.orderIndex],
                environment = StageEnvironment.valueOf(stageRow[Stages.environment]),
                displayName = stageRow[Stages.displayName],
                gatePolicies = policies,
            )
        }

        return toPipelineResponse(pipelineRow, stages)
    }

    private fun toSummary(row: ResultRow): PipelineSummary {
        val pipelineId = row[Pipelines.id]
        val stageIds = Stages
            .select(Stages.id)
            .where { Stages.pipelineId eq pipelineId }
            .map { it[Stages.id] }

        return PipelineSummary(
            id = pipelineId,
            name = row[Pipelines.name],
            flagKey = row[Pipelines.flagKey],
            projectKey = row[Pipelines.projectKey],
            description = row[Pipelines.description],
            isActive = row[Pipelines.isActive],
            version = row[Pipelines.version],
            stageIds = stageIds,
        )
    }

    private fun toPipelineResponse(row: ResultRow, stages: List<StageResponse>): PipelineResponse =
        PipelineResponse(
            id = row[Pipelines.id],
            name = row[Pipelines.name],
            flagKey = row[Pipelines.flagKey],
            projectKey = row[Pipelines.projectKey],
            description = row[Pipelines.description],
            isActive = row[Pipelines.isActive],
            version = row[Pipelines.version],
            stages = stages,
            createdAt = row[Pipelines.createdAt].toString(),
            updatedAt = row[Pipelines.updatedAt].toString(),
        )

    private fun toGatePolicyResponse(row: ResultRow): GatePolicyResponse =
        GatePolicyResponse(
            id = row[GatePolicies.id],
            metricType = MetricType.valueOf(row[GatePolicies.metricType]),
            threshold = row[GatePolicies.threshold],
            serviceName = row[GatePolicies.serviceName],
            comparisonMode = row[GatePolicies.comparisonMode],
            windowSeconds = row[GatePolicies.windowSeconds],
            minSampleSize = row[GatePolicies.minSampleSize],
        )
}
