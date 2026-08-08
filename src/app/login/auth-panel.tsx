import Image from "next/image";

export function AuthPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-secondary lg:block">
      <Image
        src="/auth-panel.png"
        alt="RoomMate — track rent and shared expenses, split fairly, and stay stress-free with your flatmates."
        fill
        sizes="50vw"
        className="object-cover"
        priority
      />
    </div>
  );
}
