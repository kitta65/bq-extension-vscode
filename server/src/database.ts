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

type SchemaRecord = {
  project: string;
  dataset: string;
  table: string;
  column: string;
  data_type: string;
};

sqlite3.verbose();

export class CacheDB {
  public static async initialize(filename: string) {
    await fs.promises.mkdir(dirname(filename), { recursive: true });
    const db = new CacheDB(filename);
    db.db.configure("busyTimeout", 100 * 1000) // default value seems to be 10 * 1000 ms
    await db.run(
      "CREATE TABLE IF NOT EXISTS schemas (project TEXT, dataset TEXT, table_name TEXT, column TEXT, data_type TEXT, PRIMARY KEY (project, dataset, table_name, column));"
    );
    return db;
  }

  private db: sqlite3.Database;
  private bqClient = new BigQuery();

  private constructor(filename: string) {
    this.db = new sqlite3.Database(filename);
  }

  public clearCache() {
    return new Promise<void>((resolve) => {
      // NOTE `run()` is not suitable here because it runs only one statement.
      this.db.exec(
        `
BEGIN;
DROP TABLE schemas;
CREATE TABLE schemas (project TEXT, dataset TEXT, table_name TEXT, column TEXT, data_type TEXT, PRIMARY KEY (project, dataset, table_name, column));
COMMIT;`,
        (_) => {
          resolve();
        }
      );
    });
  }

  public close() {
    if (this.db.open) {
      this.db.close();
    }
  }

  public select(sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, (err, rows) => {
        if (err) {
          reject(err);
        }
        resolve(rows);
      });
    });
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
    const projects = await this.getAvailableProjects();

    const datasetResults: { project: string; dataset: string }[][] = [];
    for (const proj of projects) {
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
        datasetResults.push(rows);
      } catch (err) {
        /* NOP */
      }
    }
    const datasetRecords = datasetResults.reduce((x, y) => x.concat(y), []);

    const insertQueries: Promise<void>[] = [];
    for (const dataset of datasetRecords) {
      let schemaRecords: SchemaRecord[] = [];
      try {
        if (!texts.some((txt) => txt.includes(dataset.dataset))) continue;
        const [job] = await this.bqClient.createQueryJob({
          query: `
SELECT
  table_catalog AS project,
  table_schema AS dataset,
  table_name AS table,
  column_name AS column,
  data_type,
FROM \`${dataset.project}\`.\`${dataset.dataset}\`.INFORMATION_SCHEMA.COLUMNS
LIMIT 10000;`,
        });
        const [rows] = await job.getQueryResults();
        schemaRecords = rows;
      } catch (err) {
        /* NOP */
      }
      schemaRecords.forEach((s) =>
        insertQueries.push(
          this.run(
            "INSERT OR IGNORE INTO schemas (project, dataset, table_name, column, data_type) VALUES (?, ?, ?, ?, ?)",
            [s.project, s.dataset, s.table, s.column, s.data_type]
          )
        )
      );
    }
    await Promise.all(insertQueries);
  }
}
