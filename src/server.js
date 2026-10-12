import http from 'node:http';
import {createWorker} from './worker.js';
import {localStore} from './local-store.js';
import {VERSION} from './version.js';
const port=Number(process.env.PORT||8797),base=`http://127.0.0.1:${port}`;
const db=localStore(process.env.LOCAL_DB_PATH||'work/guardian.sqlite');
const env={...process.env,MONITOR_DB:db,PUBLIC_BASE_URL:base};
const worker=createWorker();let busy=false;
async function refresh(){if(busy)return;busy=true;try{await worker.scheduled({scheduledTime:Date.now()},env);}catch{console.error('MONITOR_OR_CHAIN_FAILED');}finally{busy=false;}}
await refresh();const timer=setInterval(refresh,60000);timer.unref();
const server=http.createServer(async(req,res)=>{
 try{
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403);return res.end();}
  let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>8192){res.writeHead(413);return res.end();}chunks.push(c);}
  const request=new Request(base+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const r=await worker.fetch(request,env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"REQUEST_UNAVAILABLE","transactionsSent":0}');}
});
server.requestTimeout=100000;server.headersTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log(`BNB Guardian ${VERSION} local service ready at ${base}. No signer configured.`));
function stop(){clearInterval(timer);server.close(()=>db.close());}process.on('SIGTERM',stop);process.on('SIGINT',stop);
