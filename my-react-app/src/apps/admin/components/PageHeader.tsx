import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card/30 p-4 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-foreground">
          {icon && <span className="text-xl">{icon}</span>}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

