import net from 'node:net';
const ports=[8080,5173];
const active=await Promise.all(ports.map(port=>new Promise(resolve=>{
  const socket=net.connect({host:'127.0.0.1',port});
  let settled=false;
  function finish(open){if(settled)return;settled=true;socket.destroy();resolve(open?port:null);}
  socket.once('connect',()=>finish(true));
  socket.once('error',()=>finish(false));
  socket.setTimeout(500,()=>finish(false));
})));
if(active.some(Boolean)){
  console.error(`Stop services on ports ${active.filter(Boolean).join(', ')} before setup/full verification. A running JVM must keep its jar unchanged. Use frontend's test:e2e alone to test the running demo.`);
  process.exit(1);
}
