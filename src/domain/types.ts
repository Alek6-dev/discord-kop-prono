export type GrandPrixStatus =
  | "scheduled"
  | "open"
  | "locked"
  | "awaiting_results"
  | "scored"
  | "published"
  | "archived";

export type WeekendType = "normal" | "sprint";

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
  polemanDriverId: string;
  p1DriverId: string;
  p2DriverId: string;
  p3DriverId: string;
  fastestLapDriverId?: string;
};

export type NormalizedRaceResult = {
  grandPrixId: string;
  polemanDriverId: string;
  raceTop10DriverIds: string[];
  fastestLapDriverId?: string;
};
