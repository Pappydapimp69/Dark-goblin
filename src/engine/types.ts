// All types from CLAUDE.md §4. No logic lives here.

export type NpcId = string;
export type SlotId = string;
export type GoalId = string;

export type FlagValue = boolean | number | string;
export type NpcStateValue = string | number | boolean;

export type SlotKind = "storefront" | "job" | "house" | "partner";
export type GoalStatus = "open" | "fulfilled" | "failed";
export type ImpactKind = "help" | "harm" | "self" | "neutral";
export type EffectSource = "player" | "world";
export type GameStatus =
  | "day"
  | "night"
  | "goblin_nightfall"
  | "goblin_break"
  | "review";

// ---------------------------------------------------------------- conditions

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string; eq?: FlagValue }
  | { npc: NpcId; key: string; eq?: NpcStateValue; gte?: number; lte?: number }
  | { slotHolder: SlotId; is: NpcId | null }
  | { slotExists: SlotId }
  | { money: { gte?: number; lte?: number } }
  | { loopGte: number }
  | { goalStatus: GoalId; is: GoalStatus };

// ------------------------------------------------------------------- effects

export type Effect =
  | { setFlag: string; value: FlagValue }
  | { setNpc: NpcId; key: string; value: NpcStateValue }
  | { addNpc: NpcId; key: string; delta: number }
  | { moveSlot: SlotId; to: NpcId | null }
  | { createSlot: SlotId }
  | { money: number }
  | { schedule: Effect; inLoops: number };

// --------------------------------------------------------------------- state

/**
 * The seeded RNG's own state travels inside GameState so a save restores the
 * stream exactly. `state` is the live register (O(1) restore); `count` is
 * bookkeeping that makes a skipped draw visible in tests.
 */
export interface RngState {
  seed: number;
  state: number;
  count: number;
}

export interface DayMeter {
  score: number;
  max: number;
  interactions: number;
}

export interface NpcState {
  id: NpcId;
  name: string;
  state: Record<string, NpcStateValue>;
  broken: boolean;
  goalIds: GoalId[];
  /**
   * Whether this person is in town this life. The whole roster is
   * instantiated so conditions can always resolve, but only the present are
   * met, tick, or offer choices.
   */
  present: boolean;
}

export interface Slot {
  id: SlotId;
  kind: SlotKind;
  holder: NpcId | null;
  exists: boolean;
}

export interface Path {
  id: string;
  complete: Condition;
  closed: Condition;
}

export interface Goal {
  id: GoalId;
  owner: NpcId;
  critical: boolean;
  label: string;
  paths: Path[];
  status: GoalStatus;
  adjacentPool?: GoalId[];
}

export interface Impact {
  target: NpcId | "player";
  kind: ImpactKind;
}

export interface Choice {
  id: string;
  npc: NpcId;
  text: string;
  available: Condition;
  effects: Effect[];
  impacts: Impact[];
  /** The single choice that stays available after this NPC breaks (§5.4). */
  aftermath?: boolean;
}

export interface ScheduledEffect {
  atLoop: number;
  effect: Effect;
  source: EffectSource;
}

export interface ClosureEvent {
  goalId: GoalId;
  owner: NpcId;
  critical: boolean;
  causedByPlayer: boolean;
}

export type LedgerEntry =
  | {
      kind: "impact";
      loop: number;
      choiceId: string;
      target: NpcId | "player";
      impact: ImpactKind;
      delta: number;
    }
  | {
      kind: "goal";
      loop: number;
      goalId: GoalId;
      owner: NpcId;
      critical: boolean;
      outcome: "fulfilled" | "failed";
      causedByPlayer: boolean;
      delta: number;
      maxDelta: number;
    }
  | {
      kind: "pressure";
      loop: number;
      bill: number;
      paid: number;
      delta: number;
    };

export type GoblinEntry =
  | { kind: "break"; loop: number; goalId: GoalId; owner: NpcId; lineId: string }
  | {
      kind: "nightfall";
      loop: number;
      questionId: string;
      answerId: string;
      closureGoalIds: GoalId[];
    };

/** The goblin visit currently on screen, if any. */
export interface PendingGoblin {
  kind: "break" | "nightfall";
  /** Break only: the authored line for this critical failure. */
  lineId?: string;
  /** Break only: which goal broke. */
  goalId?: GoalId;
  owner?: NpcId;
  /** Nightfall only: the selected questions, asked in order. */
  questionIds: string[];
  /** Nightfall only: how many have been answered so far. */
  cursor: number;
  /** Nightfall only: the closures that keyed the selection. */
  closureGoalIds: GoalId[];
  /** Where play resumes once he leaves: mid-day, or the rest of end-of-day. */
  resume: "day" | "endOfDay";
}

export interface GameState {
  seed: number;
  rng: RngState;
  loop: number;
  lifespan: { current: number; max: number };
  day: DayMeter;
  money: number;
  debt: number;
  npcs: Record<NpcId, NpcState>;
  slots: Record<SlotId, Slot>;
  goals: Record<GoalId, Goal>;
  flags: Record<string, FlagValue>;
  scheduled: ScheduledEffect[];
  closedToday: ClosureEvent[];
  ledger: LedgerEntry[];
  goblinLog: GoblinEntry[];
  status: GameStatus;
  pendingGoblin: PendingGoblin | null;
}

// ------------------------------------------------------------------- content

export interface TickRule {
  id: string;
  when: Condition;
  effects: Effect[];
}

export interface NpcDef {
  id: NpcId;
  name: string;
  state: Record<string, NpcStateValue>;
  goalIds: GoalId[];
  /** Per-NPC advancement applied at the world tick (§5.5). */
  tick?: TickRule[];
  /**
   * "player" is the state holder for the person playing — always present,
   * never rolled, never counted against the town's size. Everyone else is a
   * townsperson.
   */
  role?: "player" | "townsperson";
  /** Which of the four locations they are found at. Read by the Street scene. */
  location?: string;
}

export interface SlotDef {
  id: SlotId;
  kind: SlotKind;
  holder: NpcId | null;
  exists: boolean;
}

export interface GoalTemplate {
  id: GoalId;
  owner: NpcId;
  critical: boolean;
  label: string;
  paths: Path[];
  adjacentPool?: GoalId[];
}

export interface GoblinAnswer {
  id: string;
  text: string;
}

export interface GoblinQuestion {
  id: string;
  text: string;
  answers: GoblinAnswer[];
  /** Goals this question is keyed to; absent means it fits any closure. */
  forGoals?: GoalId[];
}

export interface GoblinBreakLine {
  id: string;
  goalId: GoalId;
  text: string;
}

export interface GoblinContent {
  questions: GoblinQuestion[];
  breaks: GoblinBreakLine[];
  verdicts: { self: string[]; others: string[] };
}

export interface RentModifier {
  id: string;
  when: Condition;
  amount: number;
}

export interface RulesContent {
  baseRent: number;
  rentModifiers: RentModifier[];
  startingMoney: number;
  startingDebt: number;
  lifespanMax: number;
  interactionsPerDay: number;
  /** Player goal templates to roll from, and how many to roll at newGame. */
  playerGoalPool: GoalId[];
  playerGoalsAtStart: number;
  /**
   * How many townspeople are in town in one life. Omit for "all of them".
   * The roster is bigger than the town: each seed deals a different cast.
   */
  townSize?: number;
  /** Townspeople who are always in town, whatever the seed. */
  pinnedNpcs?: NpcId[];
  /**
   * Goals the balance report follows by name — the authored chains whose
   * completion rate is the thing worth watching, as opposed to the incidental
   * ones. Content names them so the simulator needs no knowledge of the town.
   */
  trackedGoals?: GoalId[];
}

export interface Content {
  npcs: NpcDef[];
  slots: SlotDef[];
  goals: GoalTemplate[];
  choices: Choice[];
  goblin: GoblinContent;
  rules: RulesContent;
}
