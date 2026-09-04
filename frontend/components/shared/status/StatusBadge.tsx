import React from "react";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { ImportStatus, ImportIssueLevel, RegistryLinkStatus, HospitalNameReviewStatus, TargetChangeType } from "@/lib/types";
import { IMPORT_STATUS_LABEL_TH, IMPORT_ISSUE_LEVEL_LABEL_TH } from "@/lib/importLabels";
import { TARGET_CHANGE_TYPE_LABEL_TH } from "@/lib/targetLabels";

export type StatusBadgeType =
  | { type: "importStatus"; value: ImportStatus }
  | { type: "importIssueLevel"; value: ImportIssueLevel }
  | { type: "registryLinkStatus"; value: RegistryLinkStatus }
  | { type: "nameReviewStatus"; value: HospitalNameReviewStatus }
  | { type: "targetChangeType"; value: TargetChangeType };

const REGISTRY_LINK_LABEL_TH: Record<RegistryLinkStatus, string> = {
  UNREVIEWED: "รอตรวจสอบ",
  LINKED: "เชื่อมโยงแล้ว",
  CONFIRMED_ABSENT: "ยืนยันไม่มีข้อมูล",
};

const NAME_REVIEW_LABEL_TH: Record<HospitalNameReviewStatus, string> = {
  PENDING: "รอดำเนินการ",
  MERGED: "รวมชื่อแล้ว",
  KEPT_SEPARATE: "แยกเป็นคนละรายการ",
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusBadgeType;
  customLabel?: string;
}

export function StatusBadge({ status, customLabel, className, ...props }: StatusBadgeProps) {
  let label = customLabel;
  let variant: NonNullable<BadgeProps["variant"]> = "default";

  switch (status.type) {
    case "importStatus": {
      label = label ?? IMPORT_STATUS_LABEL_TH[status.value];
      if (status.value === "SUCCESS") variant = "success";
      else if (status.value === "PARTIAL") variant = "warning";
      else if (status.value === "FAILED") variant = "destructive";
      else variant = "info";
      break;
    }
    case "importIssueLevel": {
      label = label ?? IMPORT_ISSUE_LEVEL_LABEL_TH[status.value];
      if (status.value === "WARNING") variant = "warning";
      else variant = "destructive";
      break;
    }
    case "registryLinkStatus": {
      label = label ?? REGISTRY_LINK_LABEL_TH[status.value];
      if (status.value === "LINKED") variant = "success";
      else if (status.value === "UNREVIEWED") variant = "warning";
      else variant = "secondary";
      break;
    }
    case "nameReviewStatus": {
      label = label ?? NAME_REVIEW_LABEL_TH[status.value];
      if (status.value === "MERGED") variant = "info";
      else if (status.value === "KEPT_SEPARATE") variant = "success";
      else variant = "warning";
      break;
    }
    case "targetChangeType": {
      label = label ?? (TARGET_CHANGE_TYPE_LABEL_TH[status.value] ?? status.value);
      if (status.value === "CREATE") variant = "success";
      else if (status.value === "UPDATE") variant = "info";
      else variant = "destructive";
      break;
    }
  }

  return (
    <Badge variant={variant} className={className} {...props}>
      {label}
    </Badge>
  );
}