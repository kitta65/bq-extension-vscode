# BigQuery Language Sever
⚠️ This language server is designed to be used by [bq-extension-vscode](https://github.com/dr666m1/bq-extension-vscode).
Some features might be ignored by other client.

## Install
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
1. Install [coc.nvim](https://github.com/neoclide/coc.nvim)
2. Modify `coc-settings.json` and `.vimrc` (See the examples below)

```jsonc
// coc-settings.json
// You may have to restart Vim or run `:CocRestart` after modification.
{
  "languageserver": {
    "bigquery": {
      "command": "bq-language-server",
      "args": ["--stdio"],
      "filetypes": ["sql", "bigquery"],
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

```vim
" .vimrc
inoremap ` `<left>`
command! BQUpdateCache call CocRequestAsync("bigquery", "bq/updateCache")
command! BQClearCache call CocRequestAsync("bigquery", "bq/clearCache")
command! BQDryRun call CocRequestAsync("bigquery", "bq/dryRun", {"uri": "file://" . expand("%:p")})
```
