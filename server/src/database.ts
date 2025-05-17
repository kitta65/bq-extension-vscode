import * as fs from "fs";
import { BigQuery } from "@google-cloud/bigquery";
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

  private async getAvailableDatasets(project: string) {
    const [datasets] = await this.bqClient.getDatasets({ projectId: project });
    return datasets.map((dataset) => ({
      project,
      dataset: dataset.id!,
      location: dataset.location!,
    }));
  }

  public async updateCache(texts: string[], targetProjects: string[]) {
    const projects = [
      ...new Set([...targetProjects, await this.bqClient.getProjectId()]),
    ];
    const updateProjects = this.nedb
      .removeAsync({ dataset: null, table: null }, { multi: true })
      .then(() =>
        this.nedb.insertAsync(
          projects.map((project) => ({
            project,
            dataset: null,
            table: null,
          })),
        ),
      );
    const updateDatasets = Promise.all(
      projects.map(async (proj) => this.updateCacheDatasets(texts, proj)),
    );
    await Promise.all([updateProjects, updateDatasets]);
  }

  private async updateCacheDatasets(texts: string[], project: string) {
    const datasets = await this.getAvailableDatasets(project);

    const updateDatasets = this.nedb
      .removeAsync(
        {
          project,
          dataset: { $ne: null },
          table: null,
        },
        { multi: true },
      )
      .then(() => {
        const docs = datasets.map((dataset) => ({
          project: dataset.project,
          dataset: dataset.dataset,
          table: null,
          location: dataset.location,
        }));
        return this.nedb.insertAsync(docs);
      });

    const updateTables = Promise.all(
      datasets.map((dataset) => {
        if (!texts.some((txt) => txt.includes(dataset.dataset))) {
          return;
        }
        return this.updateCacheTables(
          dataset.project,
          dataset.dataset,
          dataset.location,
        );
      }),
    );

    return Promise.all([updateDatasets, updateTables]);
  }

  private async updateCacheTables(
    project: string,
    dataset: string,
    location: string,
  ) {
    const options = {
      query: `
SELECT DISTINCT
  table_catalog AS project,
  table_schema AS dataset,
  REGEXP_REPLACE(table_name, r"([^0-9])[0-9]{8,}$", r"\\1*") AS table,
  ARRAY_AGG(STRUCT(column_name AS column, data_type)) as columns,
FROM \`${project}\`.\`${dataset}\`.INFORMATION_SCHEMA.COLUMNS
GROUP BY project, dataset, table
LIMIT 10000;`,
      location: location,
    };

    const [job] = await this.bqClient.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    await this.nedb.removeAsync(
      {
        project: project,
        dataset: dataset,
        table: { $ne: null },
      },
      { multi: true },
    );
    await this.nedb.insertAsync(
      rows.map((row) => ({
        project: row.project,
        dataset: row.dataset,
        table: row.table,
        location: location,
        columns: row.columns,
      })),
    );
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
