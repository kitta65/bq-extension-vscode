import * as sqlite3 from "sqlite3";
import * as fs from "fs";
import { BigQuery } from "@google-cloud/bigquery";
import { exec } from "child_process";
import { dirname } from "path";
import * as https from "https";
declare module "sqlite3" {
  interface Database {
    open: boolean;
  }
}

type DatasetRecord = {
  project: string;
  dataset: string;
};

type ColumnRecord = {
  project: string;
  dataset: string;
  table: string;
  column: string;
  data_type: string;
};

sqlite3.verbose();

const createTableProjects = `
CREATE TABLE IF NOT EXISTS projects (
  project TEXT,
  PRIMARY KEY (project)
);`;
const createTableDatasets = `
CREATE TABLE IF NOT EXISTS datasets (
  project TEXT,
  dataset TEXT,
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
    db.db.configure("busyTimeout", 100 * 1000); // default value seems to be 10 * 1000 ms
    await Promise.all([
      db.run(createTableProjects),
      db.run(createTableDatasets),
      db.run(createTableColumns),
    ]);
    return db;
  }

  private db: sqlite3.Database;
  private bqClient = new BigQuery();

  private constructor(filename: string) {
    this.db = new sqlite3.Database(filename);
  }

  public async clearCache() {
    await this.exec(`
BEGIN;
DROP TABLE projects;
DROP TABLE datasets;
DROP TABLE columns;
${createTableProjects}
${createTableDatasets}
${createTableColumns}
COMMIT;`);
  }

  private exec(sql: string) {
    return new Promise<void>((resolve) => {
      this.db.exec(sql, (_) => {
        resolve();
      });
    });
  }

  public close() {
    if (this.db.open) {
      this.db.close();
    }
  }

  public select(sql: string, params?: any[]): Promise<any[]> {
    if (params) {
      return new Promise((resolve, reject) => {
        this.db.all(sql, ...params, (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
          }
          resolve(rows);
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        this.db.all(sql, (err, rows) => {
          if (err) {
            reject(err);
          }
          resolve(rows);
        });
      });
    }
  }

  private run(sql: string, params?: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (params) {
        /* NOTE
         * Type inference is a little confusiong here.
         * The last argument (arrow function) is also considered as a part of `params`.
         */
        this.db.run(sql, ...params, (err: Error | null) => {
          if (err) {
            reject(err);
          }
          resolve();
        });
      } else {
        this.db.run(sql, (err) => {
          if (err) {
            reject(err);
          }
          resolve();
        });
      }
    });
  }

  private async getAvailableProjects() {
    const token = await this.getToken();
    return new Promise<string[]>((resolve) => {
      https
        .request(
          "https://bigquery.googleapis.com/bigquery/v2/projects",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          (res) => {
            res.on("data", (chunk) => {
              const json: {
                projects: { projectReference: { projectId: string } }[];
              } = JSON.parse("" + chunk);
              const projects = json.projects.map((x) => {
                return x.projectReference.projectId;
              });
              resolve(projects);
            });
          }
        )
        .end();
    });
  }

  private async getToken() {
    return new Promise<string>((resolve) => {
      exec(
        "gcloud auth application-default print-access-token",
        (_, stdout) => {
          resolve(stdout.trim()); // remove "\n"
        }
      );
    });
  }

  public async updateCache(texts: string[]) {
    const insertQueries: Promise<void>[] = [];

    // cache projects
    const projects = await this.getAvailableProjects();
    await this.exec(`
BEGIN;
DROP TABLE projects;
${createTableProjects}
COMMIT;`);
    projects.forEach((proj) => {
      insertQueries.push(
        this.run(`INSERT OR IGNORE INTO projects (project) VALUES (?);`, [proj])
      );
    });

    // cache datasets
    const datasetRecords: DatasetRecord[] = [];
    for (const proj of projects) {
      if (!texts.some((txt) => txt.includes(proj))) continue;
      try {
        const [job] = await this.bqClient.createQueryJob({
          query: `
SELECT
  catalog_name AS project,
  schema_name AS dataset,
FROM \`${proj}\`.INFORMATION_SCHEMA.SCHEMATA
LIMIT 10000;`,
        });
        const [rows] = await job.getQueryResults();
        await this.run("DELETE FROM datasets WHERE project = ?", [proj]);
        rows.forEach((row) => {
          datasetRecords.push(row);
          insertQueries.push(
            this.run(
              `INSERT OR IGNORE INTO datasets (project, dataset) VALUES (?, ?);`,
              [row.project, row.dataset]
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
        const [job] = await this.bqClient.createQueryJob({
          query: `
SELECT DISTINCT
  table_catalog AS project,
  table_schema AS dataset,
  REGEXP_REPLACE(table_name, r'[0-9]{2,}$', '*') AS table,
  column_name AS column,
  data_type,
FROM \`${dataset.project}\`.\`${dataset.dataset}\`.INFORMATION_SCHEMA.COLUMNS
LIMIT 10000;`,
        });
        const [rows] = await job.getQueryResults();
        columnRecords = rows;
        await this.run("DELETE FROM columns WHERE dataset = ?", [dataset]);
      } catch (err) {
        /* NOP */
      }
      columnRecords.forEach((c) =>
        insertQueries.push(
          this.run(
            "INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES (?, ?, ?, ?, ?);",
            [c.project, c.dataset, c.table, c.column, c.data_type]
          )
        )
      );
    }
    await Promise.all(insertQueries);
  }
}
