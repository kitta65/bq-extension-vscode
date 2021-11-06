# BQ Language Sever
⚠️ This language server is designed to be used by [bq-extension-vscode](https://github.com/dr666m1/bq-extension-vscode).
Some features might be ignored by other client.

## Install
This package has not been published to any registry yet.

```bash
git clone https://github.com/dr666m1/bq-extension-vscode.git
cd bq-extension-vscode
npm install
npm run compile
cd server
npm install -g .
```

## Usage
### Vim
1. install [coc.nvim](https://github.com/neoclide/coc.nvim)
2. add the following configuration to `coc-settings.json`

```json
{
  "languageserver": {
    "bigquery": {
      "command": "bq-language-server",
      "args": ["--stdio"],
      "filetypes": ["sql", "bq"],
      "settings": {
        "bqExtensionVSCode": {
          "diagnostic": {
            "forVSCode": false
          }
        }
      }
    }
  }
}
```

You can use `CocRequestAsync` instead of VSCode commands (e.g. `:call CocRequestAsync("bigquery", "bq/updateCache")`).
