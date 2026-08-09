/**
 * Role seed — the ONLY place role names exist in code. The authorization
 * layer never learns them; it reads flags `[07 A5 C1]`.
 *
 * Exactly six roles `[07 A5]`. Desk rep is deliberately absent — still open
 * `[10 §13]`. The flag matrix derives from the user-truth notes:
 *
 *  - Super admin: "Yes to everything" `[07 A5]`.
 *  - Executive: "Monitoring, changing targets, seeing everything. No
 *    operational data entry" `[07 A5]`. Boundary vs super admin still open
 *    `[07 F4]` — only what the note states.
 *  - Sales manager: approves shares/assignments `[07 A5]`, sets targets
 *    `[07 D1]`, manager screens span all reps `[07 D6]`, and manages users
 *    (founder decision, phase 6 — "offboarding" `[07 A5]`).
 *  - Sales coordinator: quotations and dispatch `[07 A5]`, accepts in FACET
 *    `[04 flow 10]`.
 *  - Marketing: "works as a rep, plus can assign leads and companies
 *    directly" `[07 A5]`.
 *  - Sales rep: field sales, no elevated flags.
 *  - can_export: bulk export is super-admin only `[07 B8]`.
 *  - can_impersonate: super admin logs in as a rep `[07 A5 Q5]`.
 *  - can_manage_users: super admin + sales manager (founder decision,
 *    phase 6).
 */

export const ROLE_SEED = [
  {
    nameEn: "Super Admin",
    nameAr: "مدير النظام",
    canAssign: true,
    canShare: true,
    canExport: true,
    canSetTargets: true,
    seesAllReps: true,
    canDispatch: true,
    canApproveQuotation: true,
    canImpersonate: true,
    canManageUsers: true,
  },
  {
    nameEn: "Executive",
    nameAr: "تنفيذي",
    canAssign: false,
    canShare: false,
    canExport: false,
    canSetTargets: true,
    seesAllReps: true,
    canDispatch: false,
    canApproveQuotation: false,
    canImpersonate: false,
    canManageUsers: false,
  },
  {
    nameEn: "Sales Manager",
    nameAr: "مدير المبيعات",
    canAssign: true,
    canShare: true,
    canExport: false,
    canSetTargets: true,
    seesAllReps: true,
    canDispatch: false,
    canApproveQuotation: false,
    canImpersonate: false,
    canManageUsers: true,
  },
  {
    nameEn: "Sales Coordinator",
    nameAr: "منسق المبيعات",
    canAssign: false,
    canShare: false,
    canExport: false,
    canSetTargets: false,
    seesAllReps: false,
    canDispatch: true,
    canApproveQuotation: true,
    canImpersonate: false,
    canManageUsers: false,
  },
  {
    nameEn: "Marketing",
    nameAr: "التسويق",
    canAssign: true,
    canShare: false,
    canExport: false,
    canSetTargets: false,
    seesAllReps: false,
    canDispatch: false,
    canApproveQuotation: false,
    canImpersonate: false,
    canManageUsers: false,
  },
  {
    nameEn: "Sales Rep",
    nameAr: "مندوب مبيعات",
    canAssign: false,
    canShare: false,
    canExport: false,
    canSetTargets: false,
    seesAllReps: false,
    canDispatch: false,
    canApproveQuotation: false,
    canImpersonate: false,
    canManageUsers: false,
  },
] as const;

/** How the bootstrap script finds the super admin role without the
 *  authorization layer ever learning a role name. */
export const SUPER_ADMIN_NAME_EN = ROLE_SEED[0].nameEn;
