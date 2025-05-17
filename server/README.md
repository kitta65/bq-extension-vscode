# BigQuery Language Sever

> [!WARNING]
> This language server is designed to be used by [bq-extension-vscode](https://github.com/kitta65/bq-extension-vscode).
> Some features might be ignored by other client.

## Install

```bash
git clone https://github.com/kitta65/bq-extension-vscode.git
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
            "forVSCode": false,
          },
        },
      },
    },
  },
}
```

```vim
" .vimrc
inoremap ` `<left>`
command! BQUpdateCache call CocRequestAsync("bigquery", "bq/updateCache")
command! BQClearCache call CocRequestAsync("bigquery", "bq/clearCache")
command! BQDryRun call CocRequestAsync("bigquery", "bq/dryRun", {"uri": "file://" . expand("%:p")})
```

### Neovim

1. Enable [packer.nvim](https://github.com/wbthomason/packer.nvim)
2. Modify your configuration

```lua
require('packer').startup(function()
  use 'wbthomason/packer.nvim'
  -- ... other packages ...
  use {
    "neovim/nvim-lspconfig",
    config = function()
      local lspconfig = require'lspconfig'
      -- See :h lspconfig-adding-servers
      local configs = require'lspconfig.configs'
      if not configs.bqls then
        configs.bqls = {
          default_config = {
            cmd = {'bq-language-server', '--stdio'},
            filetypes = {'sql', 'bigquery'},
            root_dir = function(fname) return
              lspconfig.util.find_git_ancestor(fname)
              or vim.fn.fnamemodify(fname, ':h')
            end,
            settings = {bqExtensionVSCode = {
              diagnostic = {forVSCode = false}
            }},
          },
        }
      end
      lspconfig.bqls.setup{}
    end,
  }
  -- ... other packages ...
end)

vim.cmd[[
command! BQUpdateCache lua vim.lsp.buf_request(0, "bq/updateCache", nil, function() end)
command! BQClearCache lua vim.lsp.buf_request(0, "bq/clearCache", nil, function() end)
command! BQDryRun lua vim.lsp.buf_request(0, "bq/dryRun", {uri = "file://" .. vim.fn.expand("%:p")}, function() end)
]]
```
