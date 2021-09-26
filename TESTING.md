# Test the Extension
## Prerequisite
### authentication
In order to execute tests, you have to setup authentication.
The easiest way is using the Google Cloud SDK (your default GCP project will be used).

```
gcloud auth application-default login
```

### dataset and table
Run the following query to creat dataset and table.

```
CREATE SCHEMA IF NOT EXISTS bq_extension_vscode_test;
CREATE OR REPLACE TABLE bq_extension_vscode_test.t (
  str STRING,
  int INT64,
  float FLOAT64,
  ts TIMESTAMP,
  dt DATE,
  bool BOOLEAN,
  nested STRUCT<
    arr ARRAY<INT64>,
    str STRING,
    int INT64
  >
);
CREATE OR REPLACE TABLE bq_extension_vscode_test.u_20210101 (str STRING);
CREATE OR REPLACE TABLE bq_extension_vscode_test.u_20210102 (str STRING);
```

## How to execute tests?
Open VSCode and run `E2E Test`.

<img src="https://user-images.githubusercontent.com/26474260/132097030-82c1e0eb-7595-4cdf-ad81-28167b3dc8b2.png" width=300px>
