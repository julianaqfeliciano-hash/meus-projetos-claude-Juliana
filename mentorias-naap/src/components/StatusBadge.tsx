import { statusLabel, type ProfileStatus } from "@/lib/types";

const styles: Record<ProfileStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-gray-50 text-gray-700 border-gray-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {statusLabel[status]}
    </span>
  );
}
