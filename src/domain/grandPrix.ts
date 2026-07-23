export type TestGrandPrix = {
  id: string;
  name: string;
  weekendType: "normal" | "sprint";
  predictionsLockAt: Date;
};

export const testGrandPrix: TestGrandPrix = {
  id: "hungary_2026",
  name: "Grand Prix de Hongrie",
  weekendType: "normal",
  predictionsLockAt: new Date("2026-07-25T15:59:00+02:00")
};
