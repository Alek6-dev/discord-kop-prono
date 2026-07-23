export type GrandPrixStatus =
  | "scheduled"
  | "open"
  | "locked"
  | "awaiting_results"
  | "scored"
  | "published"
  | "archived";

export type WeekendType = "normal" | "sprint";

export type GrandPrix = {
  id: string;
  name: string;
  status: GrandPrixStatus;
  weekendType: WeekendType;
  predictionsOpenAt?: Date;
  predictionsLockAt: Date;
};

export type Driver = {
  id: string;
  label: string;
  team: string;
  number: number;
  emoji?: {
    name: string;
    id: string;
  };
};

export type PredictionInput = {
  grandPrixId: string;
  discordUserId: string;
  qualifyingTop3DriverIds: string[];
  raceTop10DriverIds: string[];
};

export type NormalizedRaceResult = {
  grandPrixId: string;
  qualifyingTop3DriverIds: string[];
  raceTop10DriverIds: string[];
};
