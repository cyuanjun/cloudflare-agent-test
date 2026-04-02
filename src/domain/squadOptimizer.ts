import type { PlayerRankingEntry, Position, RankingArtifact, SquadArtifact, SquadPlayer, UserPreferences, UserProfile } from "./contracts";

interface SolverInput {
  pool: Record<Position, PlayerRankingEntry[]>;
  lockedPlayerIds: Set<number>;
  spendingBudget: number;
  maxPlayersPerClub: number;
  squadRequirements: Record<Position, number>;
}

interface SolverResult {
  squad: PlayerRankingEntry[];
  totalCost: number;
  totalScore: number;
  nodesExplored: number;
}

const POSITION_ORDER: Position[] = ["GKP", "DEF", "MID", "FWD"];
const SQUAD_REQUIREMENTS: Record<Position, number> = {
  GKP: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
};

interface StateCounts {
  GKP: number;
  DEF: number;
  MID: number;
  FWD: number;
}

function emptyCounts(): StateCounts {
  return { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
}

function totalCount(counts: StateCounts): number {
  return counts.GKP + counts.DEF + counts.MID + counts.FWD;
}

function solveSquad(input: SolverInput): SolverResult | null {
  const flattenedPool = POSITION_ORDER.flatMap((position) => input.pool[position]).sort((left, right) => right.score - left.score);
  const lockedEntries = flattenedPool.filter((entry) => input.lockedPlayerIds.has(entry.playerId));
  if (lockedEntries.length !== input.lockedPlayerIds.size) {
    return null;
  }

  const lockedCounts = emptyCounts();
  const clubCounts = new Map<number, number>();
  const currentSquad: PlayerRankingEntry[] = [];
  let lockedCost = 0;
  let lockedScore = 0;

  for (const entry of lockedEntries) {
    lockedCounts[entry.position] += 1;
    if (lockedCounts[entry.position] > input.squadRequirements[entry.position]) {
      return null;
    }

    const nextClubCount = (clubCounts.get(entry.teamId) ?? 0) + 1;
    if (nextClubCount > input.maxPlayersPerClub) {
      return null;
    }

    clubCounts.set(entry.teamId, nextClubCount);
    currentSquad.push(entry);
    lockedCost += entry.price;
    lockedScore += entry.score;
  }

  if (lockedCost > input.spendingBudget) {
    return null;
  }

  const remainingNeeded: StateCounts = {
    GKP: input.squadRequirements.GKP - lockedCounts.GKP,
    DEF: input.squadRequirements.DEF - lockedCounts.DEF,
    MID: input.squadRequirements.MID - lockedCounts.MID,
    FWD: input.squadRequirements.FWD - lockedCounts.FWD,
  };
  const unlockedCandidates = flattenedPool.filter((entry) => !input.lockedPlayerIds.has(entry.playerId));
  const suffixScoreSums = new Array<number>(unlockedCandidates.length + 1).fill(0);

  for (let index = unlockedCandidates.length - 1; index >= 0; index -= 1) {
    suffixScoreSums[index] = suffixScoreSums[index + 1] + unlockedCandidates[index].score;
  }

  const suffixCounts: Record<Position, number[]> = {
    GKP: new Array<number>(unlockedCandidates.length + 1).fill(0),
    DEF: new Array<number>(unlockedCandidates.length + 1).fill(0),
    MID: new Array<number>(unlockedCandidates.length + 1).fill(0),
    FWD: new Array<number>(unlockedCandidates.length + 1).fill(0),
  };
  for (let index = unlockedCandidates.length - 1; index >= 0; index -= 1) {
    for (const position of POSITION_ORDER) {
      suffixCounts[position][index] = suffixCounts[position][index + 1];
    }
    suffixCounts[unlockedCandidates[index].position][index] += 1;
  }

  const cheapestByPosition: Record<Position, number[]> = { GKP: [0], DEF: [0], MID: [0], FWD: [0] };
  for (const position of POSITION_ORDER) {
    const prices = unlockedCandidates.filter((entry) => entry.position === position).map((entry) => entry.price).sort((left, right) => left - right);
    for (const price of prices) {
      cheapestByPosition[position].push(cheapestByPosition[position][cheapestByPosition[position].length - 1] + price);
    }
  }

  let bestSquad: PlayerRankingEntry[] | null = null;
  let bestScore = -Infinity;
  let nodesExplored = 0;

  function minCostToFill(needed: StateCounts): number {
    let total = 0;
    for (const position of POSITION_ORDER) {
      const count = needed[position];
      if (count <= 0) {
        continue;
      }
      const prefix = cheapestByPosition[position];
      if (count >= prefix.length) {
        return Infinity;
      }
      total += prefix[count];
    }
    return total;
  }

  function scoreUpperBound(index: number, currentScore: number, slotsNeeded: number): number {
    if (slotsNeeded <= 0) {
      return currentScore;
    }
    const endIndex = Math.min(unlockedCandidates.length, index + slotsNeeded);
    return currentScore + (suffixScoreSums[index] - suffixScoreSums[endIndex]);
  }

  function canStillFill(index: number, needed: StateCounts): boolean {
    for (const position of POSITION_ORDER) {
      if (suffixCounts[position][index] < needed[position]) {
        return false;
      }
    }
    return true;
  }

  function recurse(index: number, needed: StateCounts, budgetRemaining: number, currentScore: number): void {
    nodesExplored += 1;
    const slotsNeeded = totalCount(needed);
    if (slotsNeeded === 0) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestSquad = [...currentSquad];
      }
      return;
    }
    if (index >= unlockedCandidates.length || unlockedCandidates.length - index < slotsNeeded) {
      return;
    }
    if (!canStillFill(index, needed)) {
      return;
    }
    if (minCostToFill(needed) > budgetRemaining) {
      return;
    }
    if (scoreUpperBound(index, currentScore, slotsNeeded) <= bestScore) {
      return;
    }

    const entry = unlockedCandidates[index];
    const position = entry.position;
    if (needed[position] > 0 && entry.price <= budgetRemaining && (clubCounts.get(entry.teamId) ?? 0) < input.maxPlayersPerClub) {
      const updatedNeeded: StateCounts = { ...needed, [position]: needed[position] - 1 };
      const newBudgetRemaining = budgetRemaining - entry.price;
      if (canStillFill(index + 1, updatedNeeded) && minCostToFill(updatedNeeded) <= newBudgetRemaining && scoreUpperBound(index + 1, currentScore + entry.score, totalCount(updatedNeeded)) > bestScore) {
        currentSquad.push(entry);
        clubCounts.set(entry.teamId, (clubCounts.get(entry.teamId) ?? 0) + 1);
        recurse(index + 1, updatedNeeded, newBudgetRemaining, currentScore + entry.score);
        currentSquad.pop();
        const previous = (clubCounts.get(entry.teamId) ?? 1) - 1;
        if (previous <= 0) {
          clubCounts.delete(entry.teamId);
        } else {
          clubCounts.set(entry.teamId, previous);
        }
      }
    }

    recurse(index + 1, needed, budgetRemaining, currentScore);
  }

  recurse(0, remainingNeeded, input.spendingBudget - lockedCost, lockedScore);
  if (!bestSquad) {
    return null;
  }

  const finalSquad = bestSquad as PlayerRankingEntry[];
  return {
    squad: finalSquad,
    totalCost: finalSquad.reduce((sum: number, entry: PlayerRankingEntry) => sum + entry.price, 0),
    totalScore: bestScore,
    nodesExplored,
  };
}

export function buildSquadArtifact(profile: UserProfile, preferences: UserPreferences, rankings: RankingArtifact): SquadArtifact {
  const pool: Record<Position, PlayerRankingEntry[]> = {
    GKP: rankings.shortlists.GKP,
    DEF: rankings.shortlists.DEF,
    MID: rankings.shortlists.MID,
    FWD: rankings.shortlists.FWD,
  };
  const spendingBudget = 100 - preferences.budget_preferences.reserved_bank;
  const result = solveSquad({
    pool,
    lockedPlayerIds: new Set(preferences.player_preferences.locked_players),
    spendingBudget,
    maxPlayersPerClub: 3,
    squadRequirements: SQUAD_REQUIREMENTS,
  });

  if (!result) {
    return {
      agent: "squad_optimizer",
      profileId: profile.agent_id,
      datasetVersion: rankings.datasetVersion,
      generatedAt: new Date().toISOString(),
      squad: [],
      totalCost: 0,
      budgetRemaining: spendingBudget,
      totalScore: 0,
      solverStats: { nodesExplored: 0 },
      constraintViolations: [
        {
          type: "solver_failed",
          detail: "No legal squad could be built from the shortlisted pool and current locked-player constraints.",
        },
      ],
    };
  }

  const squad: SquadPlayer[] = [...result.squad]
    .sort((left, right) => {
      const positionDiff = POSITION_ORDER.indexOf(left.position) - POSITION_ORDER.indexOf(right.position);
      return positionDiff !== 0 ? positionDiff : right.score - left.score;
    })
    .map((entry) => ({
      playerId: entry.playerId,
      name: entry.name,
      teamId: entry.teamId,
      teamName: entry.teamName,
      position: entry.position,
      price: entry.price,
      score: entry.score,
      rankWithinPosition: entry.rankWithinPosition,
    }));

  return {
    agent: "squad_optimizer",
    profileId: profile.agent_id,
    datasetVersion: rankings.datasetVersion,
    generatedAt: new Date().toISOString(),
    squad,
    totalCost: result.totalCost,
    budgetRemaining: Math.max(0, Number((100 - result.totalCost).toFixed(1))),
    totalScore: result.totalScore,
    solverStats: { nodesExplored: result.nodesExplored },
    constraintViolations: [],
  };
}
