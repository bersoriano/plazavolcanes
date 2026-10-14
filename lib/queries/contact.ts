/** The shape public.list_contact_messages returns, one row per message. */
export type ContactMessageRow = {
  id: string;
  has_account: boolean;
  name: string | null;
  email: string;
  phone: string | null;
  message: string;
  created_at: string;
  attended_at: string | null;
};

/** A message written to the plaza, as administration reads it. */
export type ContactMessage = {
  id: string;
  /** Whether it still points at an account. False for a visitor, and for an account since deleted. */
  hasAccount: boolean;
  name: string | null;
  email: string;
  phone: string | null;
  message: string;
  createdAt: string;
  attendedAt: string | null;
};

export function mapContactMessages(rows: ContactMessageRow[]): ContactMessage[] {
  return rows.map((row) => ({
    id: row.id,
    hasAccount: row.has_account,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    createdAt: row.created_at,
    attendedAt: row.attended_at,
  }));
}
