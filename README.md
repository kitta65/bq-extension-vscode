# BigQuery Extension for VSCode
<img src="https://user-images.githubusercontent.com/26474260/148650103-7217fa6f-e1d2-4393-a013-6782d80837be.gif">

This is a Visual Studio Code extension for standardSQL, which is a SQL dialect supported by BigQuery.
The [language server](https://github.com/kitta65/bq-extension-vscode/tree/main/server) itself is also available by other editors.

## Features
- Complete table names (when quoted by `` ` `` ), column names (in SELECT statement) and functions
- Show hover information about tables and functions
- Dry run on save and show total bytes processed
- Format source code using [prettier-plugin-bq](https://github.com/kitta65/prettier-plugin-bq) (`Shift+Alt+F`)
- Language configuration and syntax highlight (mostly based on [sql](https://github.com/microsoft/vscode/tree/main/extensions/sql), but slightly adjusted)

## Quick Start

> [!NOTE]
> If your OS is Windows, it is recommended to develop in WSL (read the [document](https://code.visualstudio.com/docs/remote/wsl)).

1. [Install Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Run `gcloud auth login` `gcloud auth application-default login`
3. Install sqlite3
4. [Install this extension from VSCode](https://marketplace.visualstudio.com/items?itemName=kitta65.googlesql-extension-vscode)
5. Open a file (`xxx.bq` or `xxx.bigquery`)
6. Update cache (see the usage section)

## Usage
### Update Cache
The first thing you should do after installation is to update cache.
Run `BQExtensionVSCode: Update Cache` from command palette
and the information about datasets and tables will be stored in local directory (`~/.bq_extension_vscode/`).
In this process, this extension runs several queries against [INFROMATIN_SCHEMA](https://cloud.google.com/bigquery/docs/information-schema-intro).
Note that datasets which does not appear in your query will be ignored to reduce cost.

## Advanced Settings
### file extensions
This extension assumes that the file name is `xxx.bq` or `xxx.bigquery`.
If you are editting a file named `xxx.sql`, you have to map `*.sql` to `bigquery` this way.

```jsonc
// settings.json
{
  "files.associations": {
    "*.sql": "bigquery"
  }
}
```

## Feedback
I'm not ready to accept pull requests, but your feedback is always welcome.
If you find any bugs, please feel free to create an issue.
