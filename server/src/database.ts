import * as fs from "fs";
import { BigQuery } from "@google-cloud/bigquery";
import { exec } from "child_process";
import { dirname } from "path";
import Datastore from "@seald-io/nedb";

type Document = {
  project: string;
  dataset: string | null;
  table: string | null;
  location?: string;
  columns?: { column: string; data_type: string }[];
};

export class NeDB {
  public static async initialize(nedbFileName: string) {
    await fs.promises.mkdir(dirname(nedbFileName), { recursive: true });
    const db = new NeDB(nedbFileName);
    await Promise.all([db.nedb.autoloadPromise]);
    return db;
  }

  private bqClient = new BigQuery();
  public nedb: Datastore<Document>;
  private nedbFileName: string;

  private constructor(nedbFileName: string) {
    this.nedbFileName = nedbFileName;
    this.nedb = new Datastore({ filename: nedbFileName, autoload: true });
  }

  public async clearCache() {
    await this.nedb.dropDatabaseAsync();
    this.nedb = new Datastore({ filename: this.nedbFileName, autoload: true });
    await this.nedb.autoloadPromise;
  }

  private getAvailableProjects() {
    return new Promise<string[]>((resolve, reject) => {
      exec(
        "bq ls --projects=true --format=json --max_results=1000",
        (_, stdout) => {
          let obj;
          try {
            obj = JSON.parse(stdout);
          } catch {
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
    return new Promise<
      {
        project: string;
        dataset: string;
        location: string;
      }[]
    >((resolve, reject) => {
      exec(
        `bq ls --datasets=true --project_id='${project}' --format=json --max_results=1000`,
        (_, stdout) => {
          let obj;
          try {
            obj = JSON.parse(stdout || "[]");
          } catch {
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
    const asyncOperations: Promise<unknown>[] = [];

    // cache projects
    const projects = await this.getAvailableProjects();
    const projectOperation = this.nedb
      .removeAsync({ dataset: null, table: null }, { multi: true })
      .then(() =>
        this.nedb.insertAsync(
          projects.map((project) => ({ project, dataset: null, table: null })),
        ),
      );
    asyncOperations.push(projectOperation);

    // cache datasets
    let datasets: { project: string; dataset: string; location: string }[] = [];
    for (const proj of projects) {
      const rows = await this.getAvailableDatasets(proj);
      datasets = [...datasets, ...rows];

      const datasetOperation = this.nedb
        .removeAsync(
          {
            project: proj,
            dataset: { $ne: null },
            table: null,
          },
          { multi: true },
        )
        .then(() => {
          const docs = rows.map((row) => ({
            project: row.project,
            dataset: row.dataset,
            table: null,
            location: row.location,
          }));
          return this.nedb.insertAsync(docs);
        });
      asyncOperations.push(datasetOperation);
    }

    // cache tables
    for (const dataset of datasets) {
      // skip if the dataset name does not appear in SQL files
      if (!texts.some((txt) => txt.includes(dataset.dataset))) continue;

      const options = {
        query: `
SELECT DISTINCT
  table_catalog AS project,
  table_schema AS dataset,
  REGEXP_REPLACE(table_name, r"([^0-9])[0-9]{8,}$", r"\\1*") AS table,
  ARRAY_AGG(STRUCT(column_name AS column, data_type)) as columns,
FROM \`${dataset.project}\`.\`${dataset.dataset}\`.INFORMATION_SCHEMA.COLUMNS
GROUP BY project, dataset, table
LIMIT 10000;`,
        location: dataset.location,
      };

      const tableOperation = this.bqClient
        .createQueryJob(options)
        .then(([job]) => job.getQueryResults())
        .then(async ([rows]) => {
          await this.nedb.removeAsync(
            {
              project: dataset.project,
              dataset: dataset.dataset,
              table: { $ne: null },
            },
            { multi: true },
          );
          await this.nedb.insertAsync(
            rows.map((row) => ({
              project: row.project,
              dataset: row.dataset,
              table: row.table,
              location: dataset.location,
              columns: row.columns,
            })),
          );
        });
      asyncOperations.push(tableOperation);
    }

    await Promise.all(asyncOperations);
  }

  public async updateCacheForTest(_: string[]) {
    const project = "bq-extension-vscode";
    const insertProject = this.nedb.insertAsync({
      project,
      dataset: null,
      table: null,
    });

    // US
    const datasetUS = "bq_extension_vscode_test";
    const insertDatasetUS = this.nedb.insertAsync({
      project,
      dataset: datasetUS,
      table: null,
      location: "US",
    });
    const insertTablesUS = ["t", "u_*"].map((table) =>
      this.nedb.insertAsync({
        project,
        dataset: datasetUS,
        table,
        columns: [
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
        ],
      }),
    );

    // asia-northeast1
    const datasetAsia = "bq_extension_vscode_test_asia";
    const insertDatasetAsia = this.nedb.insertAsync({
      project,
      dataset: datasetAsia,
      table: null,
      location: "asia-northeast1",
    });
    const insertTableAsia = this.nedb.insertAsync({
      project,
      dataset: datasetAsia,
      table: "v",
      columns: [
        {
          column: "str",
          data_type: "STRING",
        },
      ],
    });

    await Promise.all([
      insertProject,
      insertDatasetUS,
      insertTablesUS,
      insertDatasetAsia,
      insertTableAsia,
    ]);
  }
}
