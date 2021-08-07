# BigQuery Extension for Visual Studio Code
<img src="https://user-images.githubusercontent.com/26474260/128605753-b1596da9-eee2-4f84-b121-cda73d06aa19.png" width=500px>

This is a Visual Studio Code extension for standardSQL, which is a dialect of BigQuery.
The [language server](https://github.com/dr666m1/project_bq_language_server/tree/main/server) itself is also available by other editors.

⚠️ This extension is still a work in progress, so the behavior would change frequently.

## Quick Start
1. [Install Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. run `gcloud auth application-default login`
3. Install this extension from VSCode (`bq-extension-vscode`)

## Features
- Dry run on save
- Highlight error
- Show total bytes processed in status bar

## Advanced Settings
### file extensions
This extension is activated when ths language of the file is **sql**.
If you are editting a file named **xxx.bq**, you have to map **.bq** to **sql** this way.

```
// settings.json
{
  "files.associations": {
    "*.bq": "sql",
    "*.bigquery": "sql"
  }
}
```

