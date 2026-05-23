/**
 * Records a skill usage for ranking purposes.
 * Updates both usage count and last used timestamp.
 */
export declare function recordSkillUsage(skillName: string): void;
/**
 * Calculates a usage score for a skill based on frequency and recency.
 * Higher scores indicate more frequently and recently used skills.
 *
 * The score uses exponential decay with a half-life of 7 days,
 * meaning usage from 7 days ago is worth half as much as usage today.
 */
export declare function getSkillUsageScore(skillName: string): number;
//# sourceMappingURL=skillUsageTracking.d.ts.map