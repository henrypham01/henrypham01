"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface PageHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function PageHeader({ title, actionLabel, onAction }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5 pb-4 border-b gap-4 flex-wrap">
      <h1 className="text-lg md:text-xl font-semibold tracking-tight">{title}</h1>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
