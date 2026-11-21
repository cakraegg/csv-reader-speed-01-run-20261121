// Driver for the csv-reader-speed entry. The harness runs `node main.ts`
// on Node 22: it reads every case from the input directory, answers each
// one alone with run() from solve.js, and writes the answers, in the
// cases' order, to the output directory.
//
// Incremental marking is switched off before solve.js is imported, so all
// of the parsing work runs under that setting, as the house driver does.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

setFlagsFromString('--no-incremental-marking');

const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const listed = JSON.parse(readFileSync(join(inDir, 'cases.json'), 'utf8')) as {
  id: string;
  input: unknown;
}[];

if (!Array.isArray(listed)) throw new Error('cases.json is not an array');

// Each case is answered alone, in order; nothing carries over.
const solved = listed.map((entry) => run(entry.input));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'answers.json'), JSON.stringify(solved));
