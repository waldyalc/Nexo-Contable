import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48 rounded-[10px]" />
          <Skeleton className="h-4 w-72 rounded-[8px]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-[10px]" />
          <Skeleton className="h-9 w-36 rounded-[10px]" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 rounded-[15px]" />
        <Skeleton className="h-28 rounded-[15px]" />
        <Skeleton className="h-28 rounded-[15px]" />
      </div>

      <div className="rounded-[15px] border border-border bg-card p-5">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-[10px]" />
          <Skeleton className="h-12 w-full rounded-[8px]" />
          <Skeleton className="h-12 w-full rounded-[8px]" />
          <Skeleton className="h-12 w-full rounded-[8px]" />
          <Skeleton className="h-12 w-full rounded-[8px]" />
        </div>
      </div>
    </div>
  );
}
