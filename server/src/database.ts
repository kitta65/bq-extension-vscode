import * as fs from "fs";
import { exec } from "child_process";
import { dirname } from "path";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { BigQuery } from "@google-cloud/bigquery";

type DatasetRecord = {
  project: string;
  dataset: string;
  location: string;
};

type ColumnRecord = {
  project: string;
  dataset: string;
  table_name: string;
  column: string;
  data_type: string;
};

type Data = {
  projects: string[];
  datasets: DatasetRecord[];
  columns: ColumnRecord[];
};

const EmptyData: Data = {
  projects: [],
  datasets: [],
  columns: [],
};

export class CacheDB {
  public static async initialize(filename: string) {
    await fs.promises.mkdir(dirname(filename), { recursive: true });
    const db = new CacheDB(filename);
    return db;
  }

  public db: Low<Data>;
  private bqClient = new BigQuery();

  private constructor(filename: string) {
    this.db = new Low(new JSONFile(filename), EmptyData);
  }

  public async clearCache() {
    this.db.data = EmptyData;
    await this.db.write();
  }

  public close() {
    // NOP
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
        }
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
            }
          );
          resolve(datasets);
        }
      );
    });
  }

  public async updateCache(texts: string[]) {
    // projects
    const projects = await this.getAvailableProjects();
    await this.db.update((data) => {
      data.projects = projects;
    });

    // datasets
    const datasets: DatasetRecord[] = [];
    for (const proj of projects) {
      const rows = await this.getAvailableDatasets(proj);
      rows.forEach((row) => {
        datasets.push(row);
      });
    }
    await this.db.update((data) => {
      data.datasets = datasets;
    });

    // columns
    for (const dataset of datasets) {
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
      let columns: ColumnRecord[];
      [columns] = await job.getQueryResults();
      await this.db.update((data) => {
        data.columns = data.columns.filter((column) => {
          column.project !== dataset.project &&
            column.dataset !== dataset.dataset;
        });
        columns.forEach((column) => {
          data.columns.push(column);
        });
      });
    }
  }
}
