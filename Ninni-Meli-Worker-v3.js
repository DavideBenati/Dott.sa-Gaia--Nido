// Ninni Meli v3: sandbox-only checkout. No credentials belong in this file.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
class PublicError extends Error { constructor(status, message) { super(message); this.status = status; } }
function configuration(env) {
  const site = new URL(env.SITE_URL);
  const database = new URL(env.SUPABASE_URL);
  if (site.origin !== 'https://ninnimeli.com' || site.pathname !== '/' || site.search || site.hash || site.username || site.password) throw new Error('Invalid site');
  if (database.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(database.hostname) || database.pathname !== '/' || database.port || database.search || database.hash || database.username || database.password) throw new Error('Invalid database');
  if (!env.SUPABASE_SECRET_KEY || !/^sk_test_/.test(env.STRIPE_SECRET_KEY || '')) throw new Error('Sandbox keys required');
  return {site:site.origin,database:database.origin};
}
function reply(data,status=200,origin) {
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin) headers['Access-Control-Allow-Origin']=origin;
  return new Response(JSON.stringify(data),{status,headers});
}
async function bodyText(request,limit) {
  if(Number(request.headers.get('content-length'))>limit) throw new PublicError(413,'Richiesta troppo grande.');
  if(!request.body) return '';
  const reader=request.body.getReader();const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new PublicError(413,'Richiesta troppo grande.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
  return new TextDecoder().decode(bytes);
}
async function rpc(env,config,name,args) {
  const response=await fetch(`${config.database}/rest/v1/rpc/${name}`,{
    method:'POST',headers:{apikey:env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(args),signal:AbortSignal.timeout(15000),
  });
  if(!response.ok){
    const error=await response.json().catch(()=>({}));
    if(['product_unavailable','invalid_items','duplicate_product','invalid_quantity','amount_limit','amount_too_small','order_conflict'].includes(error.message)) throw new PublicError(409,'Prodotti o quantità non disponibili. Aggiorna il catalogo e riprova.');
    throw new Error('Database operation failed');
  }
  const text=await response.text();return text?JSON.parse(text):null;
}
async function stripe(env,path,params,idempotencyKey) {
  const headers={Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2024-06-20'};
  if(params)headers['Content-Type']='application/x-www-form-urlencoded';
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{method:params?'POST':'GET',headers,body:params?.toString(),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Stripe operation failed');
  return response.json();
}
async function checkout(request,env,config) {
  if(env.ENABLE_TEST_CHECKOUT!=='true'||!env.STRIPE_WEBHOOK_SECRET)throw new PublicError(503,'Il pagamento di prova non è ancora attivo.');
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new PublicError(415,'Formato non supportato.');
  let input;try{input=JSON.parse(await bodyText(request,16384));}catch(e){if(e instanceof PublicError)throw e;throw new PublicError(400,'Richiesta non valida.');}
  if(!input||typeof input.checkout_id!=='string'||!UUID.test(input.checkout_id)||!Array.isArray(input.items)||input.items.length<1||input.items.length>10)throw new PublicError(400,'Carrello non valido.');
  const ids=new Set();
  const items=input.items.map(item=>{
    if(!item||typeof item.id!=='string'||!UUID.test(item.id)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>20)throw new PublicError(400,'Quantità non valida.');
    const id=item.id.toLowerCase();if(ids.has(id))throw new PublicError(400,'Prodotto duplicato.');ids.add(id);return {id,quantity:item.quantity};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(items)));
  const fingerprint=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const order=await rpc(env,config,'shop_prepare_order',{p_order_id:input.checkout_id.toLowerCase(),p_fingerprint:fingerprint,p_items:items});
  if(!order||!['creating','pending'].includes(order.status))throw new PublicError(409,'Questa sessione non è più disponibile.');
  let session;
  if(order.stripe_session_id){
    session=await stripe(env,`checkout/sessions/${encodeURIComponent(order.stripe_session_id)}`);
  }else{
    // Persisted expiry and snapshots keep retries byte-for-byte idempotent.
    if(order.expires_at<Math.floor(Date.now()/1000)+1800)throw new PublicError(409,'Sessione da verificare. Contatta il gestore prima di riprovare.');
    const params=new URLSearchParams({mode:'payment',locale:'it',success_url:`${config.site}/?checkout=success`,cancel_url:`${config.site}/?checkout=cancelled`,
      client_reference_id:order.id,'metadata[order_id]':order.id,'metadata[integration]':'ninni-meli-v3',expires_at:String(order.expires_at),
      'payment_method_types[0]':'card','shipping_address_collection[allowed_countries][0]':'IT',billing_address_collection:'required',
      'custom_text[submit][message]':'PROVA SANDBOX: nessun addebito reale e nessuna spedizione. Spedizione simulata senza costi aggiuntivi.'});
    order.items.forEach((item,index)=>{
      params.set(`line_items[${index}][price_data][currency]`,'eur');
      params.set(`line_items[${index}][price_data][product_data][name]`,item.name);
      params.set(`line_items[${index}][price_data][unit_amount]`,String(item.unit_amount));
      params.set(`line_items[${index}][quantity]`,String(item.quantity));
    });
    session=await stripe(env,'checkout/sessions',params,`ninni-meli-${order.id}`);
  }
  if(session.livemode!==false||session.amount_total!==order.amount_total||session.currency!=='eur'||session.metadata?.order_id!==order.id||session.metadata?.integration!=='ninni-meli-v3')throw new Error('Invalid Stripe session');
  if(session.status!=='open'||typeof session.url!=='string')throw new PublicError(409,'Questa sessione non è più disponibile.');
  const destination=new URL(session.url);
  if(destination.protocol!=='https:'||destination.hostname!=='checkout.stripe.com')throw new Error('Invalid checkout destination');
  await rpc(env,config,'shop_bind_session',{p_order_id:order.id,p_session_id:session.id});
  return {url:session.url,order_id:order.id,sandbox:true};
}
async function validSignature(raw,header,secret,now=Math.floor(Date.now()/1000)) {
  if(!header||!secret)return false;
  const parts=header.split(',').map(part=>part.trim().split('='));
  const timestamps=parts.filter(([k])=>k==='t');
  if(timestamps.length!==1||!/^\d+$/.test(timestamps[0][1]))return false;
  const timestamp=Number(timestamps[0][1]);if(!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>300)return false;
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const [kind,hex]of parts){if(kind!=='v1'||!/^[0-9a-f]{64}$/i.test(hex||''))continue;
    const bytes=Uint8Array.from(hex.match(/../g),v=>parseInt(v,16));
    if(await crypto.subtle.verify('HMAC',key,bytes,encoder.encode(`${timestamp}.${raw}`)))return true;
  }return false;
}
async function webhook(request,env,config) {
  if(!env.STRIPE_WEBHOOK_SECRET)throw new PublicError(503,'Webhook non configurato.');
  const raw=await bodyText(request,262144);
  if(!await validSignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))throw new PublicError(400,'Firma non valida.');
  let event;try{event=JSON.parse(raw);}catch{throw new PublicError(400,'Evento non valido.');}
  if(event.livemode!==false)throw new PublicError(400,'Sono consentiti soltanto eventi sandbox.');
  if(!['checkout.session.completed','checkout.session.expired'].includes(event.type))return {received:true,ignored:true};
  const session=event.data?.object;
  if(session?.metadata?.integration!=='ninni-meli-v3')return {received:true,ignored:true};
  if(!UUID.test(session.metadata?.order_id||'')||session.livemode!==false||session.currency!=='eur'||!Number.isSafeInteger(session.amount_total)||!/^cs_test_/.test(session.id||''))throw new PublicError(400,'Sessione non valida.');
  if(event.type==='checkout.session.completed'&&session.payment_status!=='paid')return {received:true,ignored:true};
  if(event.type==='checkout.session.expired'&&session.status!=='expired')throw new PublicError(400,'Stato non valido.');
  await rpc(env,config,'shop_finish_order',{p_order_id:session.metadata.order_id,p_session_id:session.id,p_amount:session.amount_total,p_currency:session.currency,p_outcome:event.type==='checkout.session.completed'?'paid':'expired'});
  return {received:true};
}
export default {
  async fetch(request,env) {
    let origin;
    try{
      const path=new URL(request.url).pathname;
      if(path==='/health'&&request.method==='GET'){
        let configured=false;try{configuration(env);configured=true;}catch{}
        return reply({service:'ninni-meli-api',version:3,sandbox_only:true,configured,webhook_configured:Boolean(env.STRIPE_WEBHOOK_SECRET),checkout_enabled:configured&&Boolean(env.STRIPE_WEBHOOK_SECRET)&&env.ENABLE_TEST_CHECKOUT==='true'},200,request.headers.get('Origin')==='https://ninnimeli.com'?'https://ninnimeli.com':undefined);
      }
      const config=configuration(env);
      if(path==='/webhook'&&request.method==='POST')return reply(await webhook(request,env,config));
      if(path!=='/checkout')return reply({error:'Risorsa non trovata.'},404);
      if(request.headers.get('Origin')!==config.site)return reply({error:'Origine non consentita.'},403);
      origin=config.site;
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}});
      if(request.method!=='POST')return reply({error:'Metodo non consentito.'},405,origin);
      return reply(await checkout(request,env,config),200,origin);
    }catch(error){
      return reply({error:error instanceof PublicError?error.message:'Servizio temporaneamente non disponibile. Non creare un nuovo tentativo: riprova con lo stesso carrello.'},error instanceof PublicError?error.status:503,origin);
    }
  }
};
