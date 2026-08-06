# 02. Access Matrix — FACET CRM

Full table of every role × resource × action. ✅ = allowed, ❌ = denied, 🔒 = own records only.

---

## Pages / Routes

| Page | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/register` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/pending` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/rep` (daily report) | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/rep/companies` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/rep/projects` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/rep/quotations` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/rep/stats` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/rep/history` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/rep/notifications` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/dashboard` (KPI) | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/dashboard/companies` | ❌ | ❌ | ✅ (read) | ✅ | ✅ |
| `/dashboard/projects` | ❌ | ❌ | ✅ (read) | ✅ | ✅ |
| `/dashboard/activities` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/quotations` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/dashboard/team` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/performance` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/followups` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/duplicates` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/import` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/notifications` | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## Database Operations

### `companies` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 own via junction | 🔒 own via junction | ✅ all | ✅ all | ✅ all |
| INSERT | ✅ via RPC only | ✅ via RPC only | ✅ | ✅ | ✅ |
| UPDATE | 🔒 own via junction | 🔒 own via junction | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### `company_reps` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 own rep_id | 🔒 own rep_id | ❌ | ✅ all | ✅ all |
| INSERT | ✅ via RPC only | ✅ via RPC only | ❌ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### `contacts` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 company assigned | 🔒 company assigned | ✅ all | ✅ all | ✅ all |
| INSERT | ✅ | ✅ | ✅ | ✅ | ✅ |
| UPDATE | 🔒 company assigned | ❌ | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### `projects` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 via project_reps | 🔒 via project_reps | ✅ all | ✅ all | ✅ all |
| INSERT | ✅ via RPC only | ✅ via RPC only | ✅ | ✅ | ✅ |
| UPDATE | 🔒 via project_reps | 🔒 via project_reps | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### `activities` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 own rep_id | 🔒 own rep_id | ❌ | ✅ all | ✅ all |
| INSERT | 🔒 own rep_id | 🔒 own rep_id | ❌ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### `quotations` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 own rep_id | 🔒 own rep_id | ✅ all | ✅ all | ✅ all |
| INSERT | ❌ | ❌ | ✅ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ✅ | ✅ | ✅ |

### `quotation_items` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 via quotation | 🔒 via quotation | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ❌ | ❌ | ✅ | ✅ | ✅ |

### `reps` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | ✅ all (names for dropdowns) | ✅ all | ✅ all | ✅ all | ✅ all |
| INSERT | ❌ (API only) | ❌ | ❌ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### `notifications` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 own recipient_id | 🔒 own | 🔒 own | ✅ all | ✅ all |
| UPDATE (mark read) | 🔒 own | 🔒 own | 🔒 own | ✅ | ✅ |
| INSERT | ✅ (system inserts) | ✅ | ✅ | ✅ | ✅ |

### `duplicate_flags` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | ❌ | ❌ | ❌ | ✅ | ✅ |
| UPDATE (classify) | ❌ | ❌ | ❌ | ✅ | ✅ |

### `company_holidays` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all |
| INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### `rep_absences` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 own | 🔒 own | ❌ | ✅ all | ✅ all |
| INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | ✅ | ✅ |

### `project_history` table
| Operation | rep | marketing | coordinator | manager | super_admin |
|---|---|---|---|---|---|
| SELECT | 🔒 via project_reps | 🔒 via project_reps | ❌ | ✅ all | ✅ all |
| INSERT | ✅ (trigger only) | ✅ | ❌ | ✅ | ✅ |
