import type { Driver } from "./types.js";

export const testDrivers: Driver[] = [
  { id: "max_verstappen", label: "Max Verstappen", team: "Red Bull Racing", number: 1 },
  { id: "lando_norris", label: "Lando Norris", team: "McLaren", number: 4 },
  { id: "charles_leclerc", label: "Charles Leclerc", team: "Ferrari", number: 16 },
  { id: "oscar_piastri", label: "Oscar Piastri", team: "McLaren", number: 81 },
  { id: "lewis_hamilton", label: "Lewis Hamilton", team: "Ferrari", number: 44 },
  { id: "carlos_sainz", label: "Carlos Sainz", team: "Williams", number: 55 }
];

export function findDriver(driverId: string, drivers: Driver[] = testDrivers): Driver | undefined {
  return drivers.find((driver) => driver.id === driverId);
}
