type SQLite = {
  query: (sql: string, arg1?: any, arg2?: any, arg3?: any) => any;
  close: () => void;
};

declare module "dblite" {
  // https://stackoverflow.com/questions/44058101/typescript-declare-third-party-modules
  function dblite(filename: string): SQLite;
  export = dblite;
}
