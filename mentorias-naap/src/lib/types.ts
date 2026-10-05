export type ProfileStatus = "pending" | "approved" | "rejected" | "blocked";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: "student" | "admin";
  status: ProfileStatus;
  active_session_id: string | null;
  accepted_terms_at: string | null;
  approved_at: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type Module = {
  id: string;
  title: string;
  description: string;
  position: number;
  published: boolean;
  created_at: string;
};

export type Video = {
  id: string;
  module_id: string;
  title: string;
  description: string;
  youtube_id: string;
  recorded_on: string | null;
  duration_minutes: number | null;
  pdf_path: string | null;
  pdf_name: string | null;
  position: number;
  published: boolean;
  notified_at: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  student_id: string;
  sold_on: string;
  amount_cents: number;
  payment_method: string;
  notes: string;
  created_at: string;
};

export type VideoProgress = {
  student_id: string;
  video_id: string;
  seconds_watched: number;
  max_position: number;
  duration: number;
  view_count: number;
  first_watched_at: string;
  last_watched_at: string;
};

export const statusLabel: Record<ProfileStatus, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
  blocked: "Bloqueado",
};

export const paymentMethods: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  outro: "Outro",
};
