export type ConstituencyResult = {
  number: number;
  constituency: string;
  status: "Result Declared" | "Leading" | "Counting" | "Unknown";
  roundsCounted: number | null;
  roundsTotal: number | null;
  winner: {
    candidate: string;
    party: string;
    partyShort: string;
    votes: number;
  } | null;
  runnerUp: {
    candidate: string;
    party: string;
    partyShort: string;
    votes: number;
  } | null;
  margin: number | null;
  totalVotes: number | null;
};

export type ResultsPayload = {
  state: string;
  stateCode: string;
  electionTitle: string;
  source: string;
  scrapedAt: string; // ISO timestamp
  totalConstituencies: number;
  results: ConstituencyResult[];
};
