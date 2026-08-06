# 01. API Overview — FACET CRM

## Architecture

FACET CRM has a minimal custom API surface. Most data operations go directly from client components to Supabase via PostgREST (the auto-generated REST API). Only operations requiring admin privileges use Next.js API routes.

---

## API Route Count

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/register` | POST | Create new user account |
| `/api/auth/callback` | GET | Supabase OAuth code exchange |

That is the complete API surface. Everything else is direct Supabase client calls.

---

## Supabase PostgREST (Primary Data API)

All CRUD operations on database tables go through Supabase's PostgREST layer at:
`https://qndpfbmniqxkegzmzcmh.supabase.co/rest/v1/`

This is abstracted by the Supabase JS client:

```typescript
// SELECT with filter
supabase.from('companies').select('*').eq('status', 'active')

// INSERT
supabase.from('activities').insert({ ... })

// UPDATE
supabase.from('projects').update({ stage: 'Won' }).eq('id', projectId)

// DELETE
supabase.from('companies').delete().eq('id', companyId)

// RPC (stored procedure)
supabase.rpc('create_project_with_rep', { ... })
```

All PostgREST requests are authenticated via the anon key + JWT session cookie. RLS policies filter data server-side.

---

## Response Format

Supabase client returns:
```typescript
{ data: T | null, error: PostgrestError | null }
```

For RPC calls returning a single value:
```typescript
{ data: uuid | number | null, error: ... }
```

---

## Error Handling Convention

```typescript
const { data, error } = await supabase.from('companies').insert({...});
if (error) {
  setError(error.message);
  setSaving(false);
  return;
}
// proceed with success
```

API routes return:
```typescript
// Success
return NextResponse.json({ success: true });

// Error
return NextResponse.json({ error: error.message }, { status: 400 });
```

---

## Rate Limits

Supabase free/pro tier rate limits apply. No custom rate limiting is implemented. At current team size (< 15 users), this is not a concern.
