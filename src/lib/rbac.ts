export const MODULES = [
  "dashboard",
  "clients",
  "matters",
  "hearings",
  "tasks",
  "documents",
  "time",
  "billing",
  "accounting",
  "hr",
  "reports",
  "settings",
  "users",
] as const;

export const ACTIONS = ["view", "create", "update", "delete", "approve"] as const;

export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];
export type PermissionKey = `${Module}:${Action}`;

const all = (m: Module): PermissionKey[] => ACTIONS.map((a) => `${m}:${a}` as PermissionKey);
const crud = (m: Module): PermissionKey[] => (["view", "create", "update"] as const).map((a) => `${m}:${a}` as PermissionKey);
const view = (m: Module): PermissionKey => `${m}:view`;

export const DEFAULT_ROLES: {
  key: string;
  nameAr: string;
  nameEn: string;
  scopeAll: boolean;
  permissions: PermissionKey[];
}[] = [
  { key: "admin", nameAr: "مدير المكتب", nameEn: "Office Manager", scopeAll: true, permissions: MODULES.flatMap(all) },
  {
    key: "partner",
    nameAr: "شريك",
    nameEn: "Partner",
    scopeAll: true,
    permissions: [
      ...(["dashboard", "clients", "matters", "hearings", "tasks", "documents", "time", "billing"] as Module[]).flatMap(all),
      view("accounting"),
      ...all("reports"),
      view("hr"),
    ],
  },
  {
    key: "lawyer",
    nameAr: "محامي",
    nameEn: "Lawyer",
    scopeAll: false,
    permissions: [
      view("dashboard"),
      ...crud("clients"),
      ...crud("matters"),
      ...crud("hearings"),
      ...crud("tasks"),
      ...crud("documents"),
      ...crud("time"),
      view("billing"),
    ],
  },
  {
    key: "consultant",
    nameAr: "مستشار قانوني",
    nameEn: "Legal Consultant",
    scopeAll: false,
    permissions: [view("dashboard"), view("clients"), ...crud("matters"), view("hearings"), ...crud("tasks"), ...crud("documents"), ...crud("time")],
  },
  {
    key: "secretary",
    nameAr: "سكرتارية",
    nameEn: "Secretary",
    scopeAll: true,
    permissions: [view("dashboard"), ...crud("clients"), view("matters"), ...crud("hearings"), ...crud("tasks"), ...crud("documents")],
  },
  {
    key: "accountant",
    nameAr: "محاسب",
    nameEn: "Accountant",
    scopeAll: true,
    permissions: [view("dashboard"), view("clients"), view("matters"), view("time"), ...all("billing"), ...all("accounting"), view("reports")],
  },
  {
    key: "hr",
    nameAr: "موارد بشرية",
    nameEn: "HR",
    scopeAll: true,
    permissions: [view("dashboard"), ...all("hr")],
  },
  { key: "client", nameAr: "عميل", nameEn: "Client", scopeAll: false, permissions: [] },
];
