import { Client } from '@opensearch-project/opensearch';
import { env } from '../../config/env.js';
import {
  buildResumeSearchIndexMapping,
  buildResumeSearchIndexName,
  RESUME_SEARCH_INDEX_SCHEMA_VERSION,
  RESUME_SEARCH_READ_ALIAS,
  RESUME_SEARCH_WRITE_ALIAS,
} from './mapping.js';

function createAdapterDisabledResult(reason) {
  return {
    healthy: false,
    enabled: false,
    provider: 'opensearch',
    reason,
  };
}

export function isResumeSearchEngineEnabled() {
  return Boolean(env.resumeSearchV2Enabled || env.resumeIndexingEnabled);
}

export class OpenSearchResumeSearchAdapter {
  constructor(config = {}) {
    this.node = config.node ?? env.openSearchNode;
    this.username = config.username ?? env.openSearchUsername;
    this.password = config.password ?? env.openSearchPassword;
    this.indexPrefix = config.indexPrefix ?? env.openSearchIndexPrefix;
    this.client = this.node
      ? new Client({
          node: this.node,
          auth: this.username ? { username: this.username, password: this.password || '' } : undefined,
        })
      : null;
  }

  get indexName() {
    return buildResumeSearchIndexName(this.indexPrefix);
  }

  ensureConfigured() {
    if (!this.client) {
      const error = new Error('OpenSearch is not configured.');
      error.code = 'OPENSEARCH_NOT_CONFIGURED';
      error.retryable = false;
      throw error;
    }
  }

  async ensureIndexVersion() {
    this.ensureConfigured();
    const exists = await this.client.indices.exists({ index: this.indexName });
    if (!exists.body) {
      await this.client.indices.create({
        index: this.indexName,
        body: buildResumeSearchIndexMapping(),
      });
    }
    await this.switchAliases({ indexName: this.indexName });
    return { indexName: this.indexName, indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION };
  }

  async getIndexHealth() {
    if (!isResumeSearchEngineEnabled()) {
      return createAdapterDisabledResult('RESUME_SEARCH_ENGINE_DISABLED');
    }
    if (!this.client) {
      return createAdapterDisabledResult('OPENSEARCH_NOT_CONFIGURED');
    }

    try {
      const [health, aliases] = await Promise.all([
        this.client.cluster.health(),
        this.client.indices.getAlias({ index: `${this.indexPrefix}-*` }).catch(() => ({ body: {} })),
      ]);
      const aliasMap = Object.entries(aliases.body || {}).reduce((acc, [indexName, value]) => {
        const names = Object.keys(value.aliases || {});
        if (names.includes(RESUME_SEARCH_READ_ALIAS)) acc.readAlias = indexName;
        if (names.includes(RESUME_SEARCH_WRITE_ALIAS)) acc.writeAlias = indexName;
        return acc;
      }, { readAlias: null, writeAlias: null });
      return {
        healthy: ['green', 'yellow'].includes(health.body.status),
        enabled: true,
        provider: 'opensearch',
        status: health.body.status,
        node: this.node,
        readAlias: aliasMap.readAlias,
        writeAlias: aliasMap.writeAlias,
        indexSchemaVersion: RESUME_SEARCH_INDEX_SCHEMA_VERSION,
      };
    } catch (error) {
      return {
        healthy: false,
        enabled: true,
        provider: 'opensearch',
        reason: error.message,
      };
    }
  }

  async openPointInTime(keepAlive = '2m') {
    this.ensureConfigured();
    const response = await this.client.createPit({
      index: RESUME_SEARCH_READ_ALIAS,
      keep_alive: keepAlive,
    });
    return response.body.pit_id;
  }

  async closePointInTime(pitId) {
    if (!pitId || !this.client) return;
    await this.client.deletePit({ body: { pit_id: pitId } }).catch(() => {});
  }

  async searchResumes({ searchRequest, pitId, searchAfter }) {
    this.ensureConfigured();
    const response = await this.client.search({
      body: {
        ...searchRequest,
        pit: { id: pitId, keep_alive: '2m' },
        search_after: searchAfter || undefined,
      },
    });
    return response.body;
  }

  async bulkIndexResumes(documents = []) {
    this.ensureConfigured();
    if (!documents.length) return { errors: false, items: [] };
    const operations = [];
    for (const document of documents) {
      operations.push({ index: { _index: RESUME_SEARCH_WRITE_ALIAS, _id: document.documentId } });
      operations.push(document);
    }
    const response = await this.client.bulk({ refresh: false, body: operations });
    return response.body;
  }

  async upsertResumeDocument(document) {
    this.ensureConfigured();
    const response = await this.client.index({
      index: RESUME_SEARCH_WRITE_ALIAS,
      id: document.documentId,
      body: document,
      refresh: false,
    });
    return response.body;
  }

  async deleteResumeDocument(documentId) {
    this.ensureConfigured();
    return this.client.delete({
      index: RESUME_SEARCH_WRITE_ALIAS,
      id: documentId,
      refresh: false,
    }).catch((error) => {
      if (error?.meta?.statusCode === 404) return { body: { result: 'not_found' } };
      throw error;
    });
  }

  async switchAliases({ indexName }) {
    this.ensureConfigured();
    const existing = await this.client.indices.getAlias({ index: `${this.indexPrefix}-*` }).catch(() => ({ body: {} }));
    const actions = [];
    for (const [knownIndex, value] of Object.entries(existing.body || {})) {
      for (const alias of Object.keys(value.aliases || {})) {
        if ([RESUME_SEARCH_READ_ALIAS, RESUME_SEARCH_WRITE_ALIAS].includes(alias) && knownIndex !== indexName) {
          actions.push({ remove: { index: knownIndex, alias } });
        }
      }
    }
    actions.push({ add: { index: indexName, alias: RESUME_SEARCH_READ_ALIAS } });
    actions.push({ add: { index: indexName, alias: RESUME_SEARCH_WRITE_ALIAS, is_write_index: true } });
    await this.client.indices.updateAliases({ body: { actions } });
  }
}

export const resumeSearchAdapter = new OpenSearchResumeSearchAdapter();
