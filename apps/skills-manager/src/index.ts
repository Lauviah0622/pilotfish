import { main } from './cli.js';

main(process.argv.slice(2)).then(
	(code) => {
		process.exitCode = code;
	},
	(err) => {
		process.stderr.write(`fatal: ${(err as Error).stack ?? err}\n`);
		process.exitCode = 2;
	},
);
