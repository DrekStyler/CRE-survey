import { UserButton } from "@clerk/nextjs";

export function Topbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div />
      <UserButton />
    </header>
  );
}
