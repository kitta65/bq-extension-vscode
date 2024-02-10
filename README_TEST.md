# Test the Extension
## Prerequisite
### authentication
In order to execute tests, you have to setup authentication.
The easiest way is using the Google Cloud SDK.

```
gcloud auth login
gcloud auth application-default login
```

The tests are executed in authenticated user's default GCP project.

> [!TIP]
> You can choose default project by `gcloud config set project your-project-id`.

### dataset and table
Run the following query to creat dataset and table.
If you get an error, check data location in query settings.

```sql
CREATE SCHEMA IF NOT EXISTS bq_extension_vscode_test OPTIONS (location='US');
CREATE OR REPLACE TABLE bq_extension_vscode_test.t (
  str STRING,
  int INT64,
  float FLOAT64,
  bool BOOLEAN,
  arr ARRAY<INT64>,
  nested STRUCT<
    arr2 ARRAY<INT64>,
    str2 STRING,
    int2 INT64,
    nested2 STRUCT<nested3 STRUCT<str4 STRING>, int3 INT64>
  >
);
CREATE OR REPLACE TABLE bq_extension_vscode_test.u_20210101 (str STRING);
CREATE OR REPLACE TABLE bq_extension_vscode_test.u_20210102 (str STRING);
```

```sql
CREATE SCHEMA IF NOT EXISTS bq_extension_vscode_test_asia OPTIONS (location='asia-northeast1');
CREATE OR REPLACE TABLE bq_extension_vscode_test_asia.v (str STRING);
```

## How to execute tests?
Open VSCode and run `E2E Test`.

<img src="https://user-images.githubusercontent.com/26474260/134948218-8bbe1a88-5adb-4d72-b1bc-560db3fe7af3.png" width=300px>
