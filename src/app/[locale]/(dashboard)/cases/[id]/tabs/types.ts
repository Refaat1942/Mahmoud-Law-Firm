import type { CurrentUser } from "@/lib/session";

export type TabProps = { matterId: string; user: CurrentUser; canEdit: boolean; locale: string };
