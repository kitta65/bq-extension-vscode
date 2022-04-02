import dblite from "dblite";
import * as fs from "fs";
import { BigQuery } from "@google-cloud/bigquery";
import { exec } from "child_process";
import { dirname } from "path";

type DatasetRecord = {
  project: string;
  dataset: string;
  location: string;
};

type ColumnRecord = {
  project: string;
  dataset: string;
  table: string;
  column: string;
  data_type: string;
};

const createTableProjects = `
CREATE TABLE IF NOT EXISTS projects (
  project TEXT,
  PRIMARY KEY (project)
);`;
const createTableDatasets = `
CREATE TABLE IF NOT EXISTS datasets (
  project TEXT,
  dataset TEXT,
  location TEXT,
  PRIMARY KEY (project, dataset)
);`;
const createTableColumns = `
CREATE TABLE IF NOT EXISTS columns (
  project TEXT,
  dataset TEXT,
  table_name TEXT,
  column TEXT,
  data_type TEXT,
  PRIMARY KEY (project, dataset, table_name, column)
);
`;

export class CacheDB {
  public static async initialize(filename: string) {
    await fs.promises.mkdir(dirname(filename), { recursive: true });
    const db = new CacheDB(filename);
    await Promise.all([
      db.query(createTableProjects),
      db.query(createTableDatasets),
      db.query(createTableColumns),
    ]);
    return db;
  }

  private db: SQLite;
  private bqClient = new BigQuery();

  private constructor(filename: string) {
    this.db = dblite(filename);
  }

  public async clearCache() {
    await this.query(`
BEGIN;
DROP TABLE projects;
DROP TABLE datasets;
DROP TABLE columns;
${createTableProjects}
${createTableDatasets}
${createTableColumns}
COMMIT;`);
  }

  public close() {
    // if the db has already been closed, it does not throw error.
    this.db.close();
  }

  public query(sql: string, paramsOrFields?: any[]): Promise<any[]>;
  public query(sql: string, params?: any[], fields?: any[]): Promise<any[]>;
  public query(sql: string, arg1?: any[], arg2?: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (arg2) {
        this.db.query(sql, arg1, arg2, (err: any, data: any[] | undefined) => {
          if (err) {
            reject(err);
          }
          resolve(data || []);
        });
      } else if (arg1) {
        this.db.query(sql, arg1, (err: any, data: any[] | undefined) => {
          if (err) {
            reject(err);
          }
          resolve(data || []);
        });
      } else {
        this.db.query(sql, (err: any, data: any[] | undefined) => {
          if (err) {
            reject(err);
          }
          resolve(data || []);
        });
      }
    });
  }

  private async getAvailableProjects() {
    return new Promise<string[]>((resolve) => {
      exec("bq ls --projects=true --format=json", (_, stdout) => {
        const projects = JSON.parse(stdout).map((x: { id: string }) => x.id);
        resolve(projects);
      });
    });
  }

  private async getAvailableDatasets(project: string) {
    return new Promise<DatasetRecord[]>((resolve) => {
      exec(
        `bq ls --datasets=true --project_id='${project}' --format=json`,
        (_, stdout) => {
          const datasets = JSON.parse(stdout).map(
            (x: {
              datasetReference: { projectId: string; datasetId: string };
              location: string;
            }) => {
              return {
                project: x.datasetReference.projectId,
                dataset: x.datasetReference.datasetId,
                location: x.location,
              };
            }
          );
          resolve(datasets);
        }
      );
    });
  }

  public async updateCache(texts: string[]) {
    const insertQueries: Promise<any>[] = [];

    // cache projects
    const projects = await this.getAvailableProjects();
    await this.query(`
BEGIN;
DROP TABLE projects;
${createTableProjects}
COMMIT;`);
    projects.forEach((proj) => {
      insertQueries.push(
        this.query(`INSERT OR IGNORE INTO projects (project) VALUES (?);`, [
          proj,
        ])
      );
    });

    // cache datasets
    const datasetRecords: DatasetRecord[] = [];
    for (const proj of projects) {
      if (!texts.some((txt) => txt.includes(proj))) continue;
      try {
        const rows = await this.getAvailableDatasets(proj);
        await this.query("DELETE FROM datasets WHERE project = ?", [proj]);
        rows.forEach((row) => {
          datasetRecords.push(row);
          insertQueries.push(
            this.query(
              `INSERT OR IGNORE INTO datasets (project, dataset, location) VALUES (?, ?, ?);`,
              [row.project, row.dataset, row.location]
            )
          );
        });
      } catch (err) {
        /* NOP */
      }
    }

    // cache columns
    for (const dataset of datasetRecords) {
      let columnRecords: ColumnRecord[] = [];
      if (!texts.some((txt) => txt.includes(dataset.dataset))) continue;
      try {
        const options = {
          query: `
SELECT DISTINCT
  table_catalog AS project,
  table_schema AS dataset,
  REGEXP_REPLACE(table_name, r"([^0-9])[0-9]{8,}$", r"\\1*") AS table,
  column_name AS column,
  data_type,
FROM \`${dataset.project}\`.\`${dataset.dataset}\`.INFORMATION_SCHEMA.COLUMNS
LIMIT 10000;`,
          location: dataset.location,
        };
        const [job] = await this.bqClient.createQueryJob(options);
        const [rows] = await job.getQueryResults();
        columnRecords = rows;
        await this.query("DELETE FROM columns WHERE dataset = ?", [
          dataset.dataset,
        ]);
      } catch (err) {
        /* NOP */
      }
      columnRecords.forEach((c) =>
        insertQueries.push(
          this.query(
            "INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES (?, ?, ?, ?, ?);",
            [c.project, c.dataset, c.table, c.column, c.data_type]
          )
        )
      );
    }
    await Promise.all(insertQueries);
  }
}
