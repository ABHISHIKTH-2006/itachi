export type CommitmentRecord = {
  id: string;
  title: string;
  description?: string;
  deadline?: string | null;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  risk?: "LOW" | "MEDIUM" | "HIGH";
  status?: "OPEN" | "COMPLETED";
  progress?: number;
  evidenceCount?: number;
  lastEvidenceAt?: unknown;
  latestEvidence?: string | null;
  project?: string;
};

const STOP_WORDS = new Set([
  "about", "after", "again", "and", "are", "been", "but", "can", "did",
  "for", "from", "have", "i", "in", "is", "it", "my", "of", "on", "the",
  "this", "to", "was", "we", "will", "with", "you", "your",
]);

function keywords(text: string) {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter(
        (word) =>
          word.length > 2 &&
          !STOP_WORDS.has(word)
      ) ?? []
  );
}

// Evidence matching stays deterministic.
// Updates can be linked even when AI finds no new task.
export function findEvidenceMatches(
  text: string,
  commitments: CommitmentRecord[]
) {
  const updateWords = keywords(text);

  return commitments.filter((commitment) => {
    if (commitment.status === "COMPLETED") return false;

    const commitmentWords = keywords(
      `${commitment.title} ${commitment.description ?? ""}`
    );

    return (
      [...updateWords].filter((word) =>
        commitmentWords.has(word)
      ).length >= 1
    );
  });
}

export type CommitmentHealth = {
  label:
    | "OVERDUE"
    | "DUE SOON"
    | "LOOSE END"
    | "ON TRACK"
    | "COMPLETED";

  score: number;

  description: string;

  action: string;

  reason: string;
};

export function getCommitmentHealth(
  commitment: CommitmentRecord
): CommitmentHealth {
  if (commitment.status === "COMPLETED") {
    return {
      label: "COMPLETED",
      score: 0,
      description: "This commitment is complete.",
      action: "No action required.",
      reason: "Commitment completed.",
    };
  }

  const evidenceCount =
    commitment.evidenceCount ?? 0;

  const progress =
    commitment.progress ?? 0;

  const deadline = commitment.deadline
    ? new Date(
        `${commitment.deadline}T23:59:59`
      )
    : null;

  const now = new Date();

  // --------------------------------------------------
  // 1. OVERDUE
  // --------------------------------------------------

  if (deadline && deadline < now) {
    return {
      label: "OVERDUE",
      score: 100,
      description:
        "The deadline has passed without completion.",
      action:
        "Complete this commitment immediately.",
      reason:
        "The deadline has already passed.",
    };
  }

  // --------------------------------------------------
  // 2. DUE SOON
  // --------------------------------------------------

  const hoursUntilDeadline = deadline
    ? (deadline.getTime() - now.getTime()) /
      (1000 * 60 * 60)
    : null;

  if (
    hoursUntilDeadline !== null &&
    hoursUntilDeadline <= 48
  ) {
    const lowProgress =
      progress < 50 && evidenceCount === 0;

    return {
      label: "DUE SOON",
      score: lowProgress ? 90 : 80,
      description:
        "This deadline is within the next 48 hours.",
      action: lowProgress
        ? "Prioritize this now and make measurable progress."
        : "Continue working on this before the deadline.",
      reason: lowProgress
        ? "The deadline is close and little or no progress is recorded."
        : "The deadline is approaching.",
    };
  }

  // --------------------------------------------------
  // 3. LOOSE END
  // --------------------------------------------------

  if (evidenceCount === 0 && progress === 0) {
    return {
      label: "LOOSE END",
      score: 60,
      description:
        "No progress update or evidence has been linked yet.",
      action:
        "Start this commitment or add a progress update.",
      reason:
        "ITACHI found no evidence that work has started.",
    };
  }

  // --------------------------------------------------
  // 4. ON TRACK
  // --------------------------------------------------

  return {
    label: "ON TRACK",
    score: 10,
    description:
      "Recent evidence indicates progress.",
    action:
      "Continue making progress.",
    reason:
      "Evidence or progress has been recorded.",
  };
}

// ------------------------------------------------------
// NEXT BEST ACTION
// ------------------------------------------------------

export type NextBestAction = CommitmentRecord & {
  health: CommitmentHealth;
};

export function getNextBestAction(
  commitments: CommitmentRecord[]
): NextBestAction | null {
  const active = commitments.filter(
    (commitment) =>
      commitment.status !== "COMPLETED"
  );

  if (active.length === 0) {
    return null;
  }

  const assessed = active.map((commitment) => ({
    ...commitment,
    health: getCommitmentHealth(commitment),
  }));

  // Higher score = more urgent.
  // Priority is used as a secondary signal.
  const priorityWeight = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  assessed.sort((a, b) => {
    const scoreDifference =
      b.health.score - a.health.score;

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const priorityDifference =
      (priorityWeight[b.priority ?? "MEDIUM"] ?? 2) -
      (priorityWeight[a.priority ?? "MEDIUM"] ?? 2);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    // If everything else is equal,
    // prefer the commitment with less progress.
    return (
      (a.progress ?? 0) -
      (b.progress ?? 0)
    );
  });

  return assessed[0];
}