package com.ffpromo.db.repositories

class RepositoryFactory {
    val pipelines: PipelineRepository = PipelineRepository()
    val promotionRuns: PromotionRunRepository = PromotionRunRepository()
    val audit: AuditRepository = AuditRepository()
    val gateResults: GateResultRepository = GateResultRepository()
    val pipelineAudit: PipelineAuditRepository = PipelineAuditRepository()

    companion object {
        fun create(): RepositoryFactory = RepositoryFactory()
    }
}
