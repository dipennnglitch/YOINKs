# Velvet Room – deploy in ~10 minutes (GitHub + Vercel + Supabase)

Vercel can't host always-on WebSocket servers, so real-time sync runs on **Supabase Realtime** (free) and Vercel serves the site plus three tiny API routes (`/api/config`, `/api/giphy`, `/api/poll`).

## 1. Supabase (realtime + video hosting)
1. Create a free project at supabase.com.
2. SQL Editor → run:
```sql
insert into storage.buckets (id,name,public,file_size_limit) values ('videos','videos',true,52428800) on conflict (id) do nothing;
create policy "anyone can upload videos" on storage.objects for insert to anon with check (bucket_id='videos');
```
3. Settings → API: copy the **Project URL** and the **anon public** key.

## 2. Keys
- Giphy: developers.giphy.com → Create an API key.
- Anthropic (optional, AI polls): console.anthropic.com. Without it, polls use a generic template.

## 3. GitHub → Vercel
1. Push this folder to a new GitHub repo.
2. vercel.com → Add New Project → import the repo. Framework: **Other**, no build command.
3. Environment Variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GIPHY_API_KEY`, optional `ANTHROPIC_API_KEY`. Deploy.

Open your Vercel URL, create a room and share the invite link.

## Notes
- Free Supabase plan: 50 MB per uploaded file. Uploaded videos stay in Storage until you delete them (Storage → videos).
- Host rules are enforced in each browser, which is fine for friends but not hardened against someone modifying the client.
- Calls use Google STUN. For strict networks add a TURN server in `public/app.js` (`ice`).
- Voice/video needs HTTPS (Vercel provides it).
