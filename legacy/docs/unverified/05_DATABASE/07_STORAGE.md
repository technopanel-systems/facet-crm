# 07. Storage — FACET CRM

## Current Status

Supabase Storage is **not in use** in FACET CRM as of Phase 6.

No storage buckets have been created. No file uploads exist in the application.

---

## Future Storage Use Cases

When storage is eventually needed, likely use cases include:

| Use Case | Suggested Bucket | Access |
|---|---|---|
| Quotation PDF attachments | `quotation-attachments` | Coordinator write, rep read (own) |
| Company logos / photos | `company-assets` | Manager write, all authenticated read |
| Material sample images | `product-samples` | Manager write, all authenticated read |

---

## Implementation Note

When adding storage, remember that Supabase Storage policies (separate from table RLS) will need to be configured. Storage policies use `storage.foldername()` and `storage.filename()` functions to scope access.
