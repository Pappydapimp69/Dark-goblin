import { writeFileSync } from "node:fs";
import { balanceReport, DEFAULT_GAMES, runAll, summarise, toCsv } from "./report";
// Phase 2 runs against the Phase 1 fixture; Phase 3 swaps in the real town and
// this line becomes an import from src/content.
import { testContent } from "../../tests/fixtures/content";

const games = Number(process.env["SIM_GAMES"] ?? DEFAULT_GAMES);

const rows = runAll(testContent(), games);
writeFileSync("sim-report.csv", toCsv(rows), "utf8");

process.stdout.write(`${games} games per bot, seeds 1-${games}\n\n`);
process.stdout.write(`${summarise(rows)}\n\n`);
process.stdout.write(`${balanceReport(rows)}\n\n`);
process.stdout.write(`wrote sim-report.csv (${rows.length} rows)\n`);
