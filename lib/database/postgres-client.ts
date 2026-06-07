/**
 * PostgreSQL Client - Compatible avec l'interface AirtableClient
 * Permet de basculer facilement d'Airtable vers PostgreSQL
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Options pour la méthode list()
 */
export interface ListOptions {
  filterByFormula?: string;
  where?: Record<string, any>;
  orderBy?: { field: string; direction?: 'asc' | 'desc' };
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
  private _pool: Pool | null = null;
  private readonly connectionString?: string;

  constructor(connectionString?: string) {
    // Pool paresseux : ne PAS créer la connexion ici. De nombreux services
    // appellent getPostgresClient() au chargement de module ; pendant
    // `next build` (collecte des page data), ces modules sont évalués sans
    // DATABASE_URL et le throw du constructeur faisait échouer le build
    // (« Failed to collect page data for /api/... »). La connexion n'est
    // requise qu'au premier accès réel à la base.
    this.connectionString = connectionString;
  }

  private get pool(): Pool {
    if (this._pool) return this._pool;

    const connString = this.connectionString || process.env.DATABASE_URL;
    if (!connString) {
      throw new Error('DATABASE_URL is required. Please check your .env.local file.');
    }

    // Configuration du pool selon l'environnement
    const poolConfig: any = {
      connectionString: connString,
      max: 20, // Pool de 20 connexions max
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    };

    // Activer SSL pour les connexions Neon/production
    if (connString.includes('sslmode=require') || connString.includes('neon.tech')) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    this._pool = new Pool(poolConfig);
    return this._pool;
  }

  /**
   * Récupérer plusieurs enregistrements
   */
  async list<T>(tableName: string, options: ListOptions = {}): Promise<T[]> {
    const {
      filterByFormula,
      where,
      orderBy,
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

    // WHERE clause (direct where object)
    if (where && Object.keys(where).length > 0) {
      const whereClauses = Object.entries(where).map(([key, value]) => {
        params.push(value);
        return `${key} = $${params.length}`;
      });
      const whereStr = whereClauses.join(' AND ');
      query += filterByFormula ? ` AND ${whereStr}` : ` WHERE ${whereStr}`;
    }

    // ORDER BY clause (orderBy takes precedence over sort).
    // Les champs sont convertis en snake_case : les services passent des
    // noms PascalCase (EntryDate, Priority…) qui, envoyés bruts, donnent
    // « column "entrydate" does not exist » — toutes les listes triées en
    // PascalCase étaient en erreur 500 silencieuse.
    if (orderBy) {
      query += ` ORDER BY ${this.toSnakeCase(orderBy.field)} ${orderBy.direction?.toUpperCase() || 'ASC'}`;
    } else if (sort.length > 0) {
      const orderClauses = sort.map(s => `${this.toSnakeCase(s.field)} ${s.direction?.toUpperCase() || 'ASC'}`);
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
    // Convertir les résultats de snake_case vers PascalCase
    return result.rows.map(row => this.mapRowToPascalCase<T>(row));
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

    return this.mapRowToPascalCase<T>(result.rows[0]);
  }

  /**
   * Créer un nouvel enregistrement
   */
  async create<T>(tableName: string, data: Partial<T>): Promise<T> {
    // Convertir les clés de PascalCase vers snake_case
    const snakeData = this.mapDataToSnakeCase(data);
    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO ${tableName} (${keys.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return this.mapRowToPascalCase<T>(result.rows[0]);
  }

  /**
   * Mettre à jour un enregistrement
   */
  async update<T>(tableName: string, recordId: string, data: Partial<T>): Promise<T> {
    // Convertir les clés de PascalCase vers snake_case
    const snakeData = this.mapDataToSnakeCase(data);
    const keys = Object.keys(snakeData);
    const values = Object.values(snakeData);
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

    return this.mapRowToPascalCase<T>(result.rows[0]);
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
  async query<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  /**
   * Lister avec un WHERE SQL paramétré, résultats mappés en PascalCase.
   * À préférer à filterByFormula dès que le filtre dépasse l'égalité
   * simple : le parseur de formule ignore SILENCIEUSEMENT toute formule
   * sans accolades (lecture de table entière).
   */
  async listWhere<T>(
    tableName: string,
    whereSql: string,
    params: any[] = [],
    options: { orderBy?: string; limit?: number } = {}
  ): Promise<T[]> {
    let query = `SELECT * FROM ${tableName} WHERE ${whereSql}`;
    if (options.orderBy) query += ` ORDER BY ${options.orderBy}`;
    if (options.limit) query += ` LIMIT ${options.limit}`;
    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToPascalCase<T>(row));
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
   * Fermer le pool de connexions (no-op si jamais ouvert)
   */
  async close(): Promise<void> {
    if (this._pool) {
      await this._pool.end();
      this._pool = null;
    }
  }

  /**
   * Parser une formule Airtable en clause WHERE SQL
   * Supporte les cas simples pour la migration
   */
  private parseFilterFormula(formula: string, params: any[]): string {
    // Accepte {field} = 'value' OU {field} = "value" OU {field} = 0/1/true/false
    const conditionRegex = /\{(\w+)\}\s*=\s*(?:['"]([^'"]*)['"]|(true|false|\d+(?:\.\d+)?))/i;

    const buildClause = (condition: string): string => {
      const match = condition.match(conditionRegex);
      if (!match) return '';
      const [, field, quotedValue, rawValue] = match;
      let value: any;
      if (quotedValue !== undefined) {
        value = quotedValue;
      } else if (/^(true|false)$/i.test(rawValue)) {
        value = rawValue.toLowerCase() === 'true';
      } else {
        value = Number(rawValue);
      }
      params.push(value);
      return `${this.toSnakeCase(field)} = $${params.length}`;
    };

    // Cas AND: AND({Field1} = 'value1', {Field2} = 0)
    const andMatch = formula.match(/^AND\((.*)\)$/);
    if (andMatch) {
      const conditions = andMatch[1].split(/,\s*(?![^{}]*\})/);
      const whereClauses = conditions.map(buildClause).filter(Boolean);
      return whereClauses.join(' AND ');
    }

    // Cas OR: OR({Field1} = 'value1', {Field2} = 'value2')
    const orMatch = formula.match(/^OR\((.*)\)$/);
    if (orMatch) {
      const conditions = orMatch[1].split(/,\s*(?![^{}]*\})/);
      const whereClauses = conditions.map(buildClause).filter(Boolean);
      return whereClauses.join(' OR ');
    }

    // Cas simple: {Field} = value
    const simple = buildClause(formula);
    if (simple) return simple;

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

  /**
   * Convertir snake_case en PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Convertir les clés d'un objet de snake_case vers PascalCase
   */
  private mapRowToPascalCase<T>(row: any): T {
    if (!row) return row;
    const result: any = {};
    for (const key in row) {
      const pascalKey = this.toPascalCase(key);
      result[pascalKey] = row[key];
    }
    return result as T;
  }

  /**
   * Convertir les clés d'un objet de PascalCase vers snake_case
   */
  private mapDataToSnakeCase(data: any): any {
    if (!data) return data;
    const result: any = {};
    for (const key in data) {
      const snakeKey = this.toSnakeCase(key);
      result[snakeKey] = data[key];
    }
    return result;
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
