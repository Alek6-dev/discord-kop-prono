import type { WeekendType } from "../domain/types.js";

const JOLPICA_ERGAST_URL = "https://api.jolpi.ca/ergast/f1";

type JolpicaRace = {
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit?: {
    Location?: {
      country?: string;
    };
  };
  Qualifying?: JolpicaSession;
  Sprint?: JolpicaSession;
  SprintQualifying?: JolpicaSession;
  SprintShootout?: JolpicaSession;
};

type JolpicaSession = {
  date: string;
  time?: string;
};

export type ImportedGrandPrix = {
  id: string;
  seasonId: string;
  name: string;
  country?: string;
  round: number;
  weekendType: WeekendType;
  raceStartsAt: Date;
  qualifyingStartsAt?: Date;
  sprintStartsAt?: Date;
  sprintQualifyingStartsAt?: Date;
  predictionsOpenAt: Date;
  predictionsLockAt: Date;
  resultsFetchAfterAt: Date;
};

export async function fetchSeasonCalendar(year: number): Promise<ImportedGrandPrix[]> {
  const url = `${JOLPICA_ERGAST_URL}/${year}/races.json?limit=500`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "KOP-Discord-Prono/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not fetch F1 calendar from Jolpica (${response.status}).`);
  }

  const data = (await response.json()) as {
    MRData?: {
      RaceTable?: {
        Races?: JolpicaRace[];
      };
    };
  };
  const races = data.MRData?.RaceTable?.Races;

  if (!races?.length) {
    throw new Error(`No races found for F1 season ${year}.`);
  }

  return races.map((race) => normalizeRace(year, race));
}

function normalizeRace(year: number, race: JolpicaRace): ImportedGrandPrix {
  const raceStartsAt = parseErgastDateTime(race.date, race.time);
  const qualifyingStartsAt = race.Qualifying
    ? parseErgastDateTime(race.Qualifying.date, race.Qualifying.time)
    : undefined;
  const sprintStartsAt = race.Sprint
    ? parseErgastDateTime(race.Sprint.date, race.Sprint.time)
    : undefined;
  const sprintQualifyingSource = race.SprintQualifying ?? race.SprintShootout;
  const sprintQualifyingStartsAt = sprintQualifyingSource
    ? parseErgastDateTime(sprintQualifyingSource.date, sprintQualifyingSource.time)
    : undefined;
  const weekendType: WeekendType = sprintStartsAt ? "sprint" : "normal";
  const predictionsLockAt =
    sprintQualifyingStartsAt ?? sprintStartsAt ?? qualifyingStartsAt ?? raceStartsAt;

  return {
    id: `${slugify(race.raceName)}_${year}`,
    seasonId: String(year),
    name: race.raceName,
    country: race.Circuit?.Location?.country,
    round: Number(race.round),
    weekendType,
    raceStartsAt,
    qualifyingStartsAt,
    sprintStartsAt,
    sprintQualifyingStartsAt,
    predictionsOpenAt: new Date(predictionsLockAt.getTime() - 7 * 24 * 60 * 60 * 1000),
    predictionsLockAt,
    resultsFetchAfterAt: new Date(raceStartsAt.getTime() + 3 * 60 * 60 * 1000)
  };
}

function parseErgastDateTime(date: string, time = "00:00:00Z") {
  const normalizedTime = time.endsWith("Z") ? time : `${time}Z`;
  const parsed = new Date(`${date}T${normalizedTime}`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid Ergast date/time: ${date} ${time}`);
  }

  return parsed;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
