module.exports=async(q,res)=>{
  const{title='',chat=[]}=q.body||{},key=process.env.ANTHROPIC_API_KEY;
  const fb={q:`How are you finding ${title||'this video'}?`,options:['Loving it','It is fine','Not for me','Rewatch it'],fallback:true};
  if(!key)return res.json(fb);
  try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
    headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:300,messages:[{role:'user',content:
    `Watch party video: "${title}". Recent chat: ${chat.slice(-8).join(' | ')}\nWrite one fun poll about it. Reply ONLY JSON: {"q":"...","options":["...","...","...","..."]}`}]})});
    const d=await r.json();res.json(JSON.parse(d.content[0].text.replace(/```json|```/g,'').trim()))}
  catch{res.json(fb)}};
