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

  private getAvailableProjects() {
    return new Promise<string[]>((resolve, reject) => {
      exec(
        "bq ls --projects=true --format=json --max_results=1000",
        (_, stdout) => {
          let obj;
          try {
            obj = JSON.parse(stdout);
          } catch (_) {
            reject(new Error("Cannot parse stdout!"));
            return;
          }
          const projects = obj.map((x: { id: string }) => x.id);
          resolve(projects);
        },
      );
    });
  }

  private getAvailableDatasets(project: string) {
    return new Promise<DatasetRecord[]>((resolve, reject) => {
      exec(
        `bq ls --datasets=true --project_id='${project}' --format=json --max_results=1000`,
        (_, stdout) => {
          let obj;
          try {
            obj = JSON.parse(stdout);
          } catch (_) {
            reject(new Error("Cannot parse stdout!"));
            return;
          }
          const datasets = obj.map(
            (x: {
              datasetReference: { projectId: string; datasetId: string };
              location: string;
            }) => {
              return {
                project: x.datasetReference.projectId,
                dataset: x.datasetReference.datasetId,
                location: x.location,
              };
            },
          );
          resolve(datasets);
        },
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
        ]),
      );
    });

    // cache datasets
    const datasetRecords: DatasetRecord[] = [];
    for (const proj of projects) {
      const rows = await this.getAvailableDatasets(proj);
      await this.query("DELETE FROM datasets WHERE project = ?", [proj]);
      rows.forEach((row) => {
        datasetRecords.push(row);
        insertQueries.push(
          this.query(
            `INSERT OR IGNORE INTO datasets (project, dataset, location) VALUES (?, ?, ?);`,
            [row.project, row.dataset, row.location],
          ),
        );
      });
    }

    // cache columns
    for (const dataset of datasetRecords) {
      let columnRecords: ColumnRecord[] = [];
      if (!texts.some((txt) => txt.includes(dataset.dataset))) continue;
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
      await this.query(
        "DELETE FROM columns WHERE project = ? and dataset = ?",
        [dataset.project, dataset.dataset],
      );
      columnRecords.forEach((c) =>
        insertQueries.push(
          this.query(
            "INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES (?, ?, ?, ?, ?);",
            [dataset.project, dataset.dataset, c.table, c.column, c.data_type],
          ),
        ),
      );
    }
    await Promise.all(insertQueries);
  }

  public async updateCacheForTest(_: string[]) {
    const insertQueries: Promise<any>[] = [];

    // US
    const project = "bq-extension-vscode";
    const dataset = "bq_extension_vscode_test";
    insertQueries.push(
      this.query(`INSERT OR IGNORE INTO projects (project) VALUES (?);`, [
        project,
      ]),
    );
    insertQueries.push(
      this.query(
        `INSERT OR IGNORE INTO datasets (project, dataset, location) VALUES (?, ?, ?);`,
        [project, dataset, "US"],
      ),
    );
    for (const table of ["t", "u_*"]) {
      const columns: { column: string; data_type: string }[] = [
        { column: "str", data_type: "STRING" },
        { column: "int", data_type: "INT64" },
        { column: "float", data_type: "FLOAT64" },
        { column: "bool", data_type: "BOOLEAN" },
        { column: "arr", data_type: "ARRAY<INT64>" },
        {
          column: "nested",
          data_type:
            "STRUCT<arr2 ARRAY<INT64>, str2 STRING, int2 INT64, nested2 STRUCT<nested3 STRUCT<str4 STRING>, int3 INT64>>",
        },
      ];
      columns.forEach((c) =>
        insertQueries.push(
          this.query(
            "INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES (?, ?, ?, ?, ?);",
            [project, dataset, table, c.column, c.data_type],
          ),
        ),
      );
    }

    // asia-northeast1
    const datasetAsia = "bq_extension_vscode_test_asia";
    insertQueries.push(
      this.query(
        `INSERT OR IGNORE INTO datasets (project, dataset, location) VALUES (?, ?, ?);`,
        [project, datasetAsia, "asia-northeast1"],
      ),
    );
    insertQueries.push(
      this.query(
        "INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES (?, ?, ?, ?, ?);",
        [project, datasetAsia, "v", "str", "STRING"],
      ),
    );

    await Promise.all(insertQueries);
  }
}
