import { writeFileSync } from "node:fs";
import { balanceReport, chainReport, DEFAULT_GAMES, runAll, summarise, toCsv } from "./report";
import { content } from "../content";

const games = Number(process.env["SIM_GAMES"] ?? DEFAULT_GAMES);

const rows = runAll(content, games);
writeFileSync("sim-report.csv", toCsv(rows), "utf8");

process.stdout.write(`${games} games per bot, seeds 1-${games}\n\n`);
process.stdout.write(`${summarise(rows)}\n\n`);
process.stdout.write(`${chainReport(rows, content.rules.trackedGoals ?? [])}\n\n`);
process.stdout.write(`${balanceReport(rows)}\n\n`);
process.stdout.write(`wrote sim-report.csv (${rows.length} rows)\n`);
