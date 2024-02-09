CREATE TABLE IF NOT EXISTS projects (
  project TEXT,
  PRIMARY KEY (project)
);
CREATE TABLE IF NOT EXISTS datasets (
  project TEXT,
  dataset TEXT,
  location TEXT,
  PRIMARY KEY (project, dataset)
);
CREATE TABLE IF NOT EXISTS columns (
  project TEXT,
  dataset TEXT,
  table_name TEXT,
  column TEXT,
  data_type TEXT,
  PRIMARY KEY (project, dataset, table_name, column)
);
INSERT OR IGNORE INTO projects (project) VALUES ('bq-extension-vscode');
INSERT OR IGNORE INTO datasets (project, dataset, location) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'US');
INSERT OR IGNORE INTO datasets (project, dataset, location) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test_asia', 'asia-northeast1');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 't', 'str', 'STRING');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 't', 'int', 'INT64');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 't', 'float', 'FLOAT64');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 't', 'bool', 'BOOLEAN');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 't', 'arr', 'ARRAY<INT64>');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 't', 'nested', 'STRUCT<arr2 ARRAY<INT64>, str2 STRING, int2 INT64, nested2 STRUCT<nested3 STRUCT<str4 STRING>, int3 INT64>>');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210101', 'str', 'STRING');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210101', 'int', 'INT64');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210101', 'float', 'FLOAT64');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210101', 'bool', 'BOOLEAN');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210101', 'arr', 'ARRAY<INT64>');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210101', 'nested', 'STRUCT<arr2 ARRAY<INT64>, str2 STRING, int2 INT64, nested2 STRUCT<nested3 STRUCT<str4 STRING>, int3 INT64>>');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210102', 'str', 'STRING');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210102', 'int', 'INT64');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210102', 'float', 'FLOAT64');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210102', 'bool', 'BOOLEAN');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210102', 'arr', 'ARRAY<INT64>');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test', 'u_20210102', 'nested', 'STRUCT<arr2 ARRAY<INT64>, str2 STRING, int2 INT64, nested2 STRUCT<nested3 STRUCT<str4 STRING>, int3 INT64>>');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test_asia', 'v', 'str', 'STRING');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test_asia', 'v', 'int', 'INT64');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test_asia', 'v', 'float', 'FLOAT64');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test_asia', 'v', 'bool', 'BOOLEAN');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test_asia', 'v', 'arr', 'ARRAY<INT64>');
INSERT OR IGNORE INTO columns (project, dataset, table_name, column, data_type) VALUES ('bq-extension-vscode', 'bq_extension_vscode_test_asia', 'v', 'nested', 'STRUCT<arr2 ARRAY<INT64>, str2 STRING, int2 INT64, nested2 STRUCT<nested3 STRUCT<str4 STRING>, int3 INT64>>');