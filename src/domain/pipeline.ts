import type { Env, RunResult, UserPreferences, UserProfile } from "./contracts";
import { buildRankingArtifact } from "./ranking";
import { ensureSharedDataset } from "./sharedDataset";
import { buildSquadArtifact } from "./squadOptimizer";

export async function executeRun(
  env: Env,
  userProfile: UserProfile,
  userPreferences: UserPreferences,
  onProgress?: (message: string) => Promise<void>,
): Promise<RunResult> {
  const dataset = await ensureSharedDataset(env, onProgress);

  await onProgress?.("Ranking players with the uploaded profile weights.");
  const rankings = buildRankingArtifact(
    userProfile,
    userPreferences,
    dataset.players,
    dataset.playerFeatures,
    dataset.fixtureDifficultySummary,
    dataset.datasetVersion,
    dataset.currentGameweek,
  );

  await onProgress?.("Solving the optimal legal 15-man squad.");
  const squad = buildSquadArtifact(userProfile, userPreferences, rankings);

  return {
    profileId: userProfile.agent_id,
    generatedAt: new Date().toISOString(),
    datasetVersion: dataset.datasetVersion,
    rankings: rankings.rankings,
    shortlists: rankings.shortlists,
    squad: squad.squad,
    totalCost: squad.totalCost,
    budgetRemaining: squad.budgetRemaining,
    totalScore: squad.totalScore,
    constraintViolations: squad.constraintViolations,
  };
}
