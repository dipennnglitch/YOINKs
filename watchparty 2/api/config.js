module.exports=(q,r)=>r.json({url:process.env.SUPABASE_URL||'',key:process.env.SUPABASE_ANON_KEY||''});
