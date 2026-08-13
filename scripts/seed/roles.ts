/**
 * Role seed — the ONLY place role names exist in code. The authorization
 * layer never learns them; it reads flags `[07 A5 C1]`.
 *
 * Seven roles: the six of `07 A5` plus the desk rep, confirmed and specified
 * in `12 §2`. The flag matrix derives from the user-truth notes:
 *
 *  - Super admin: "Yes to everything" `[07 A5]`.
 *  - Executive: `12 §3` settles the boundary `07 F4` left open — sees all
 *    reps, sets targets, exports, manages users, approves deletes, resolves
 *    duplicates, sets credit splits. Deliberately NOT dispatch or quotation
 *    approval: those are operational acts performed by coordinators. What
 *    separates super admin from executive is impersonation and system
 *    configuration `[12 §3]`. This supersedes the narrow reading of `11 §1`.
 *  - Sales manager: approves shares/assignments/deletes/duplicate resolution
 *    `[07 A5]`, sets targets `[07 D1]`, manager screens span all reps
 *    `[07 D6]`, manages users (`11 §1`), sets credit splits `[12 §1]`.
 *  - Sales coordinator: quotations and dispatch `[07 A5]`, accepts in FACET
 *    `[04 flow 10]`, and sets credit splits — the coordinator performs the
 *    actual dispatch, which is why `12 §1` grants it here too.
 *  - Marketing: "works as a rep, plus can assign leads and companies
 *    directly" `[07 A5]`.
 *  - Desk rep: "the sales_rep set, plus can_assign" `[12 §2]`, which today
 *    makes it flag-identical to marketing. It stays a separate role because
 *    it is a separate job — `12 §2` is explicit that the desk rep is not
 *    internal sales — and because the two will diverge as flags are added.
 *    NOTE: `12 §2`'s prose says the desk rep "assigns or shares the rest",
 *    but its flag list grants only `can_assign`. The explicit list is taken;
 *    `can_share` is not granted on the strength of the gloss alone.
 *  - Sales rep: field sales, no elevated flags.
 *  - can_export: bulk export is super-admin only `[07 B8]`, plus the
 *    executive `[12 §3]`.
 *  - can_impersonate: super admin logs in as a rep `[07 A5 Q5]`.
 *  - sees_all_records_readonly: `25 §28` restores `04 Q10` and widens it. The
 *    **coordinator** is who it is for — coordinators already have full access
 *    to SMAC, so withholding a read in FACET protects nothing — plus the
 *    **super admin**, who is "yes to everything" `[07 A5]`. It is granted to
 *    nobody else, and deliberately NOT to the four roles that already hold
 *    `sees_all_reps`: `25 §28` makes this a separate, third visibility tier,
 *    not a top-up for people who can already see everything and act on it.
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
    canSetCreditSplit: true,
    canApproveDelete: true,
    canResolveDuplicate: true,
    seesAllRecordsReadonly: true,
  },
  {
    nameEn: "Executive",
    nameAr: "تنفيذي",
    canAssign: false,
    canShare: false,
    canExport: true,
    canSetTargets: true,
    seesAllReps: true,
    canDispatch: false,
    canApproveQuotation: false,
    canImpersonate: false,
    canManageUsers: true,
    canSetCreditSplit: true,
    canApproveDelete: true,
    canResolveDuplicate: true,
    seesAllRecordsReadonly: false,
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
    canSetCreditSplit: true,
    canApproveDelete: true,
    canResolveDuplicate: true,
    seesAllRecordsReadonly: false,
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
    canSetCreditSplit: true,
    canApproveDelete: false,
    canResolveDuplicate: false,
    seesAllRecordsReadonly: true,
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
    canSetCreditSplit: false,
    canApproveDelete: false,
    canResolveDuplicate: false,
    seesAllRecordsReadonly: false,
  },
  {
    nameEn: "Desk Rep",
    nameAr: "مندوب مكتبي",
    canAssign: true,
    canShare: false,
    canExport: false,
    canSetTargets: false,
    seesAllReps: false,
    canDispatch: false,
    canApproveQuotation: false,
    canImpersonate: false,
    canManageUsers: false,
    canSetCreditSplit: false,
    canApproveDelete: false,
    canResolveDuplicate: false,
    seesAllRecordsReadonly: false,
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
    canSetCreditSplit: false,
    canApproveDelete: false,
    canResolveDuplicate: false,
    seesAllRecordsReadonly: false,
  },
] as const;

/** How the bootstrap script finds the super admin role without the
 *  authorization layer ever learning a role name. */
export const SUPER_ADMIN_NAME_EN = ROLE_SEED[0].nameEn;
