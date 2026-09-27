-- Offer-outcome pipeline stages (manual accept/decline).
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'HIRED';
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'OFFER_DECLINED';
