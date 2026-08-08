import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      {/* Personal / Shared toggle skeleton */}
      <div className="flex rounded-lg border border-border bg-secondary/50 p-1">
        <div className="flex-1 h-8 rounded-md bg-muted animate-pulse" />
        <div className="flex-1 h-8 rounded-md bg-muted/50" />
      </div>

      {/* Card skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                <div className="h-3 w-16 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
