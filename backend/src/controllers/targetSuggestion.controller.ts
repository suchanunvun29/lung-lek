import { Request, Response } from "express";
import { buildTargetSuggestionPreview, RebalancePreconditionError } from "../services/targetSuggestion.service";
import { ReinstateDealBody, TargetSuggestionParams, TargetSuggestionQuery } from "../validators/targetSuggestion.validators";

export async function getTargetSuggestions(req: Request, res: Response) {
  const { year, month } = req.params as unknown as TargetSuggestionParams;
  const { mode, targetGrowthRate } = req.query as unknown as TargetSuggestionQuery;

  try {
    const payload = await buildTargetSuggestionPreview(year, month, { mode, growthRateOverride: targetGrowthRate });
    res.json(payload);
  } catch (error) {
    if (error instanceof RebalancePreconditionError) {
      return res.status(400).json({ error: error.message, missingByRegionName: error.missingByRegionName });
    }
    throw error;
  }
}

// Territory & Potential Rules ข้อ 5.1 — reinstating a cut deal affects this preview only; nothing
// is written anywhere. The manager accepts numbers into Target through the existing Phase 3/12
// target endpoints.
export async function reinstateDeal(req: Request, res: Response) {
  const body = req.body as ReinstateDealBody;

  try {
    const payload = await buildTargetSuggestionPreview(body.year, body.month, {
      mode: body.mode,
      growthRateOverride: body.targetGrowthRate,
      reinstatedInvoiceNos: new Set(body.reinstateInvoiceNos),
    });
    res.json({ ...payload, reinstatedInvoiceNos: body.reinstateInvoiceNos });
  } catch (error) {
    if (error instanceof RebalancePreconditionError) {
      return res.status(400).json({ error: error.message, missingByRegionName: error.missingByRegionName });
    }
    throw error;
  }
}
