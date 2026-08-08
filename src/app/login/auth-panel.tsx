import Image from "next/image";

export function AuthPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-10 lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-primary/10"
      />

      <div className="relative flex items-center gap-2">
        <Image src="/logo-mark.png" alt="" width={32} height={32} className="rounded-lg" />
        <span className="text-lg font-semibold tracking-tight text-foreground">
          RoomMate
        </span>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <Image
          src="/logo-mark.png"
          alt="RoomMate"
          width={220}
          height={220}
          className="drop-shadow-sm"
          priority
        />
      </div>

      <div className="relative">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Track. Split. Settle.
        </h2>
        <p className="mt-2 max-w-xs text-muted-foreground">
          Keep rent, bills, and shared expenses sorted with your roommates —
          every cycle, every room.
        </p>
      </div>
    </div>
  );
}
