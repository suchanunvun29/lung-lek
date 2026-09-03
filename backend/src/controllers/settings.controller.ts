import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import * as settingsService from "../services/settings.service";
import * as tierWeightService from "../services/tierWeight.service";
import {
  EvaluationSettingUpdateBody,
  ScoringWeightsUpdateBody,
  TierWeightsUpdateBody,
} from "../validators/settings.validators";

const REVISION_HISTORY_LIMIT = 50;

export async function getScoringWeights(_req: Request, res: Response) {
  const [weights, revisions] = await Promise.all([
    prisma.scoringWeight.findMany({ orderBy: { metric: "asc" } }),
    prisma.scoringWeightRevision.findMany({
      orderBy: { changedAt: "desc" },
      take: REVISION_HISTORY_LIMIT,
      include: { changedBy: { select: { id: true, displayName: true, email: true } } },
    }),
  ]);

  res.json({ weights, revisions });
}

export async function updateScoringWeights(req: Request, res: Response) {
  const { weights, note } = req.body as ScoringWeightsUpdateBody;

  const updated = await settingsService.updateScoringWeights(weights, req.user!.id, note);
  res.json({ weights: updated });
}

export async function getEvaluationSetting(_req: Request, res: Response) {
  const setting = await prisma.evaluationSetting.findUnique({ where: { id: "singleton" } });
  if (!setting) {
    return res.status(500).json({ error: "EvaluationSetting singleton row is missing" });
  }
  res.json({ setting });
}

export async function updateEvaluationSetting(req: Request, res: Response) {
  const body = req.body as EvaluationSettingUpdateBody;

  const setting = await prisma.evaluationSetting.update({
    where: { id: "singleton" },
    data: { ...body, updatedById: req.user!.id },
  });

  res.json({ setting });
}

export async function getTierWeights(_req: Request, res: Response) {
  const weights = await tierWeightService.getEffectiveTierWeights();
  res.json({ weights });
}

export async function updateTierWeights(req: Request, res: Response) {
  const { weights } = req.body as TierWeightsUpdateBody;
  const updated = await tierWeightService.upsertTierWeights(weights);
  res.json({ weights: updated });
}
