/**
 * PostgreSQL Client - Compatible avec l'interface AirtableClient
 * Permet de basculer facilement d'Airtable vers PostgreSQL
 */

import { Pool, PoolClient, QueryResult } from 'pg';

/**
 * Options pour la méthode list()
 */
export interface ListOptions {
  filterByFormula?: string;
  sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  maxRecords?: number;
  pageSize?: number;
  offset?: number;
  view?: string;
  fields?: string[];
}

/**
 * Options pour les opérations batch
 */
export interface BatchOptions {
  batchSize?: number;
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Client PostgreSQL compatible avec AirtableClient
 */
export class PostgresClient {
  private pool: Pool;

  constructor(connectionString?: string) {
    const connString = connectionString || process.env.DATABASE_URL;

    if (!connString) {
      throw new Error('DATABASE_URL is required. Please check your .env.local file.');
    }

    // Configuration du pool selon l'environnement
    const poolConfig: any = {
      connectionString: connString,
      max: 20, // Pool de 20 connexions max
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    // Activer SSL pour les connexions Neon/production
    if (connString.includes('sslmode=require') || connString.includes('neon.tech')) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    this.pool = new Pool(poolConfig);
  }

  /**
   * Récupérer plusieurs enregistrements
   */
  async list<T>(tableName: string, options: ListOptions = {}): Promise<T[]> {
    const {
      filterByFormula,
      sort = [],
      maxRecords,
      pageSize,
      offset = 0,
      fields = [],
    } = options;

    // Construction de la requête SELECT
    const selectFields = fields.length > 0 ? fields.join(', ') : '*';
    let query = `SELECT ${selectFields} FROM ${tableName}`;
    const params: any[] = [];

    // WHERE clause (conversion de filterByFormula en SQL)
    if (filterByFormula) {
      const whereClause = this.parseFilterFormula(filterByFormula, params);
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }
    }

    // ORDER BY clause
    if (sort.length > 0) {
      const orderClauses = sort.map(s => `${s.field} ${s.direction?.toUpperCase() || 'ASC'}`);
      query += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // LIMIT et OFFSET
    const limit = maxRecords || pageSize;
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    if (offset) {
      query += ` OFFSET ${offset}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows as T[];
  }

  /**
   * Récupérer un seul enregistrement par ID
   */
  async get<T>(tableName: string, recordId: string): Promise<T | null> {
    const query = `SELECT * FROM ${tableName} WHERE id = $1`;
    const result = await this.pool.query(query, [recordId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as T;
  }

  /**
   * Créer un nouvel enregistrement
   */
  async create<T>(tableName: string, data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO ${tableName} (${keys.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] as T;
  }

  /**
   * Mettre à jour un enregistrement
   */
  async update<T>(tableName: string, recordId: string, data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);

    const query = `
      UPDATE ${tableName}
      SET ${setClauses.join(', ')}
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    const result = await this.pool.query(query, [...values, recordId]);

    if (result.rows.length === 0) {
      throw new Error(`Enregistrement ${recordId} non trouvé dans ${tableName}`);
    }

    return result.rows[0] as T;
  }

  /**
   * Supprimer un enregistrement
   */
  async delete(tableName: string, recordId: string): Promise<void> {
    const query = `DELETE FROM ${tableName} WHERE id = $1`;
    await this.pool.query(query, [recordId]);
  }

  /**
   * Créer plusieurs enregistrements en batch
   */
  async batchCreate<T>(
    tableName: string,
    records: Partial<T>[],
    options: BatchOptions = {}
  ): Promise<T[]> {
    const { batchSize = 100, onProgress } = options;
    const results: T[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      // Utiliser une transaction pour le batch
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        for (const record of batch) {
          const created = await this.create<T>(tableName, record);
          results.push(created);
        }

        await client.query('COMMIT');

        if (onProgress) {
          onProgress(Math.min(i + batchSize, records.length), records.length);
        }
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return results;
  }

  /**
   * Mettre à jour plusieurs enregistrements en batch
   */
  async batchUpdate<T>(
    tableName: string,
    updates: Array<{ id: string; data: Partial<T> }>,
    options: BatchOptions = {}
  ): Promise<T[]> {
    const { batchSize = 100, onProgress } = options;
    const results: T[] = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        for (const { id, data } of batch) {
          const updated = await this.update<T>(tableName, id, data);
          results.push(updated);
        }

        await client.query('COMMIT');

        if (onProgress) {
          onProgress(Math.min(i + batchSize, updates.length), updates.length);
        }
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return results;
  }

  /**
   * Supprimer plusieurs enregistrements en batch
   */
  async batchDelete(
    tableName: string,
    recordIds: string[],
    options: BatchOptions = {}
  ): Promise<void> {
    const { batchSize = 100, onProgress } = options;

    for (let i = 0; i < recordIds.length; i += batchSize) {
      const batch = recordIds.slice(i, i + batchSize);

      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(', ');
      const query = `DELETE FROM ${tableName} WHERE id IN (${placeholders})`;

      await this.pool.query(query, batch);

      if (onProgress) {
        onProgress(Math.min(i + batchSize, recordIds.length), recordIds.length);
      }
    }
  }

  /**
   * Compter les enregistrements
   */
  async count(tableName: string, options: Pick<ListOptions, 'filterByFormula'> = {}): Promise<number> {
    const { filterByFormula } = options;
    let query = `SELECT COUNT(*) as count FROM ${tableName}`;
    const params: any[] = [];

    if (filterByFormula) {
      const whereClause = this.parseFilterFormula(filterByFormula, params);
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count);
  }

  /**
   * Exécuter une requête SQL personnalisée
   */
  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  /**
   * Obtenir un client pour exécuter une transaction manuelle
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Exécuter une transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fermer le pool de connexions
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Parser une formule Airtable en clause WHERE SQL
   * Supporte les cas simples pour la migration
   */
  private parseFilterFormula(formula: string, params: any[]): string {
    // Cas simple: {Field} = 'value'
    const simpleMatch = formula.match(/\{(\w+)\}\s*=\s*['"]([^'"]+)['"]/);
    if (simpleMatch) {
      const [, field, value] = simpleMatch;
      params.push(value);
      return `${this.toSnakeCase(field)} = $${params.length}`;
    }

    // Cas AND: AND({Field1} = 'value1', {Field2} = 'value2')
    const andMatch = formula.match(/AND\((.*)\)/);
    if (andMatch) {
      const conditions = andMatch[1].split(/,\s*(?![^{}]*\})/);
      const whereClauses = conditions.map(condition => {
        const match = condition.match(/\{(\w+)\}\s*=\s*['"]([^'"]+)['"]/);
        if (match) {
          const [, field, value] = match;
          params.push(value);
          return `${this.toSnakeCase(field)} = $${params.length}`;
        }
        return '';
      }).filter(Boolean);

      return whereClauses.join(' AND ');
    }

    // Cas OR: OR({Field1} = 'value1', {Field2} = 'value2')
    const orMatch = formula.match(/OR\((.*)\)/);
    if (orMatch) {
      const conditions = orMatch[1].split(/,\s*(?![^{}]*\})/);
      const whereClauses = conditions.map(condition => {
        const match = condition.match(/\{(\w+)\}\s*=\s*['"]([^'"]+)['"]/);
        if (match) {
          const [, field, value] = match;
          params.push(value);
          return `${this.toSnakeCase(field)} = $${params.length}`;
        }
        return '';
      }).filter(Boolean);

      return whereClauses.join(' OR ');
    }

    // Par défaut, retourner la formule telle quelle (peut nécessiter un parsing plus avancé)
    console.warn(`Formule Airtable non supportée: ${formula}`);
    return '';
  }

  /**
   * Convertir PascalCase en snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
}

// Export une fonction factory pour créer une instance (Singleton)
let _instance: PostgresClient | null = null;

export function getPostgresClient(): PostgresClient {
  if (!_instance) {
    _instance = new PostgresClient();
  }
  return _instance;
}
