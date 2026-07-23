import type { Driver } from "./types.js";

export const testDrivers: Driver[] = [
  { id: "max_verstappen", label: "Max Verstappen", team: "Red Bull Racing", number: 3 },
  { id: "isack_hadjar", label: "Isack Hadjar", team: "Red Bull Racing", number: 6 },
  { id: "lando_norris", label: "Lando Norris", team: "McLaren", number: 1 },
  { id: "oscar_piastri", label: "Oscar Piastri", team: "McLaren", number: 81 },
  { id: "charles_leclerc", label: "Charles Leclerc", team: "Ferrari", number: 16 },
  { id: "lewis_hamilton", label: "Lewis Hamilton", team: "Ferrari", number: 44 },
  { id: "george_russell", label: "George Russell", team: "Mercedes", number: 63 },
  { id: "kimi_antonelli", label: "Kimi Antonelli", team: "Mercedes", number: 12 },
  { id: "fernando_alonso", label: "Fernando Alonso", team: "Aston Martin", number: 14 },
  { id: "lance_stroll", label: "Lance Stroll", team: "Aston Martin", number: 18 },
  { id: "pierre_gasly", label: "Pierre Gasly", team: "Alpine", number: 10 },
  { id: "franco_colapinto", label: "Franco Colapinto", team: "Alpine", number: 43 },
  { id: "esteban_ocon", label: "Esteban Ocon", team: "Haas", number: 31 },
  { id: "oliver_bearman", label: "Oliver Bearman", team: "Haas", number: 87 },
  { id: "liam_lawson", label: "Liam Lawson", team: "Racing Bulls", number: 30 },
  { id: "arvid_lindblad", label: "Arvid Lindblad", team: "Racing Bulls", number: 41 },
  { id: "alex_albon", label: "Alex Albon", team: "Williams", number: 23 },
  { id: "carlos_sainz", label: "Carlos Sainz", team: "Williams", number: 55 },
  { id: "nico_hulkenberg", label: "Nico Hulkenberg", team: "Audi", number: 27 },
  { id: "gabriel_bortoleto", label: "Gabriel Bortoleto", team: "Audi", number: 5 },
  { id: "valtteri_bottas", label: "Valtteri Bottas", team: "Cadillac", number: 77 },
  { id: "sergio_perez", label: "Sergio Perez", team: "Cadillac", number: 11 }
];

export function findDriver(driverId: string, drivers: Driver[] = testDrivers): Driver | undefined {
  return drivers.find((driver) => driver.id === driverId);
}
