module.exports=async(q,r)=>{
  const k=process.env.GIPHY_API_KEY,s=(q.query.q||'').trim();
  if(!k)return r.json({gifs:[],error:'Add GIPHY_API_KEY in Vercel settings'});
  try{const u=`https://api.giphy.com/v1/gifs/${s?'search':'trending'}?api_key=${k}&limit=18&rating=pg-13&q=${encodeURIComponent(s)}`;
    const d=await(await fetch(u)).json();
    r.json({gifs:(d.data||[]).map(g=>({u:g.images.fixed_height.url,p:g.images.fixed_height_small.url}))})}
  catch{r.json({gifs:[],error:'Giphy request failed'})}};
