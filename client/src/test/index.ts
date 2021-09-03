import * as path from "path";
import * as Mocha from "mocha";
import * as glob from "glob";

// NOTE If the function is not named `run`, you'll get an error.
export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", color: true });
  mocha.timeout(100 * 1000);
  const testsRoot = __dirname;
  return new Promise<void>((resolve, reject) => {
    glob("**.test.js", { cwd: testsRoot }, (err, files) => {
      if (err) {
        return reject(err);
      }
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
      try {
        mocha.run((failures) => {
          if (0 < failures) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  });
}
