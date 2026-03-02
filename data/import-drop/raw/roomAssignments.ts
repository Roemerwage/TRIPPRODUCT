export type RoomAssignment = {
  accommodation: string;
  rooms: string[];
};

const pairList = (pairs: string[]): string[] => pairs;

export const ROOM_ASSIGNMENTS: Record<string, RoomAssignment> = {
  "accommodation 1": {
    accommodation: "Accommodation 1",
    rooms: pairList([
      "Person 1 – Person 2",
      "Person 3 – Person 4",
      "Person 5 – Person 6",
      "Person 7 – Person 8",
      "Person 9 – Person 10",
    ]),
  },
  "accommodation 2": {
    accommodation: "Accommodation 2",
    rooms: pairList([
      "Person 1 – Person 3",
      "Person 2 – Person 4",
      "Person 5 – Person 7",
      "Person 6 – Person 8",
      "Person 9 – Person 10",
    ]),
  },
  "accommodation 3": {
    accommodation: "Accommodation 3",
    rooms: pairList([
      "Person 1 – Person 4",
      "Person 2 – Person 3",
      "Person 5 – Person 8",
      "Person 6 – Person 7",
      "Person 9 – Person 10",
    ]),
  },
  "accommodation 4": {
    accommodation: "Accommodation 4",
    rooms: pairList([
      "Person 1 – Person 5",
      "Person 2 – Person 6",
      "Person 3 – Person 7",
      "Person 4 – Person 8",
      "Person 9 – Person 10",
    ]),
  },
};
