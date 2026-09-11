import http from 'node:http'
const upstreamPort = Number(process.env.MARBLE_UPSTREAM_PORT || 5173)
const server = http.createServer((req,res)=>{
 const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${upstreamPort}`}}, response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)})
 upstream.on('error',error=>{res.writeHead(502);res.end(error.message)})
 req.pipe(upstream)
})
server.on('upgrade',(req,socket,head)=>{
 const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:req.url,headers:{...req.headers,host:`127.0.0.1:${upstreamPort}`}})
 upstream.on('upgrade',(res,target,targetHead)=>{socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(res.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');if(targetHead.length)socket.write(targetHead);if(head.length)target.write(head);target.pipe(socket);socket.pipe(target)})
 upstream.on('error',()=>socket.end());upstream.end()
})
server.listen(5179,'127.0.0.1',()=>console.log(`Test origin http://127.0.0.1:5179 -> existing Vite ${upstreamPort}`))
