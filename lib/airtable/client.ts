/**
 * Airtable Client - Universal CRUD operations
 */

import Airtable, { FieldSet, Records } from 'airtable';

// Configuration Airtable
const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!apiKey || !baseId) {
  throw new Error('AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env.local');
}

const airtable = new Airtable({ apiKey });
const base = airtable.base(baseId);

/**
 * Options pour les requêtes list
 */
export interface ListOptions {
  filterByFormula?: string;
  sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  maxRecords?: number;
  pageSize?: number;
  view?: string;
}

/**
 * Client universel Airtable avec opérations CRUD
 */
export class AirtableClient {
  /**
   * Liste les enregistrements d'une table
   */
  async list<T>(tableName: string, options: ListOptions = {}): Promise<T[]> {
    try {
      // Construire les options de sélection en ne gardant que les valeurs définies
      const selectOptions: any = {};

      if (options.filterByFormula) selectOptions.filterByFormula = options.filterByFormula;
      if (options.sort) selectOptions.sort = options.sort;
      if (options.maxRecords) selectOptions.maxRecords = options.maxRecords;
      if (options.pageSize) selectOptions.pageSize = options.pageSize;
      if (options.view) selectOptions.view = options.view;

      const records: Records<FieldSet> = await base(tableName)
        .select(selectOptions)
        .all();

      return records.map((record) => ({
        ...record.fields,
        _recordId: record.id,
      })) as T[];
    } catch (error) {
      console.error(`Error listing records from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Récupère un enregistrement par son ID
   */
  async get<T>(tableName: string, recordId: string): Promise<T | null> {
    try {
      const record = await base(tableName).find(recordId);
      return {
        ...record.fields,
        _recordId: record.id,
      } as T;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      console.error(`Error getting record from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Crée un nouvel enregistrement
   */
  async create<T>(tableName: string, data: Partial<T>): Promise<T> {
    try {
      const record = await base(tableName).create(data as FieldSet);
      return {
        ...record.fields,
        _recordId: record.id,
      } as T;
    } catch (error) {
      console.error(`Error creating record in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Met à jour un enregistrement
   */
  async update<T>(
    tableName: string,
    recordId: string,
    data: Partial<T>
  ): Promise<T> {
    try {
      const record = await base(tableName).update(recordId, data as FieldSet);
      return {
        ...record.fields,
        _recordId: record.id,
      } as T;
    } catch (error) {
      console.error(`Error updating record in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Supprime un enregistrement
   */
  async delete(tableName: string, recordId: string): Promise<void> {
    try {
      await base(tableName).destroy(recordId);
    } catch (error) {
      console.error(`Error deleting record from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Crée plusieurs enregistrements en batch
   */
  async batchCreate<T>(tableName: string, records: Partial<T>[]): Promise<T[]> {
    try {
      const created = await base(tableName).create(
        records.map((r) => ({ fields: r as FieldSet }))
      );
      return created.map((record) => ({
        ...record.fields,
        _recordId: record.id,
      })) as T[];
    } catch (error) {
      console.error(`Error batch creating records in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Met à jour plusieurs enregistrements en batch
   */
  async batchUpdate<T>(
    tableName: string,
    updates: Array<{ id: string; fields: Partial<T> }>
  ): Promise<T[]> {
    try {
      const updated = await base(tableName).update(
        updates.map((u) => ({
          id: u.id,
          fields: u.fields as FieldSet,
        }))
      );
      return updated.map((record) => ({
        ...record.fields,
        _recordId: record.id,
      })) as T[];
    } catch (error) {
      console.error(`Error batch updating records in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Supprime plusieurs enregistrements en batch
   */
  async batchDelete(tableName: string, recordIds: string[]): Promise<void> {
    try {
      await base(tableName).destroy(recordIds);
    } catch (error) {
      console.error(`Error batch deleting records from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Compte le nombre d'enregistrements
   */
  async count(tableName: string, filterByFormula?: string): Promise<number> {
    try {
      const records = await this.list(tableName, {
        filterByFormula,
      });
      return records.length;
    } catch (error) {
      console.error(`Error counting records in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Accès direct à l'objet base Airtable pour utilisation avancée
   */
  base(baseId?: string) {
    if (baseId) {
      return airtable.base(baseId);
    }
    return base;
  }
}
