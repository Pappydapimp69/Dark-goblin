/** Content and DSL failures are loud: file + id, never a silent default (§7). */
export class ContentError extends Error {
  constructor(
    message: string,
    readonly where: string,
  ) {
    super(`${where}: ${message}`);
    this.name = "ContentError";
  }
}

/** An illegal move against the engine's public API (not a content problem). */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}
