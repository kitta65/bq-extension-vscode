# BQ Language Sever
## Install
This package has not been published to any registry yet.

```bash
git clone https://github.com/dr666m1/project_bq_language_server.git
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
    "sql": {
      "command": "bq-language-server",
      "args": ["--stdio"],
      "filetypes": ["sql", "bq"]
    }
  }
}
```

