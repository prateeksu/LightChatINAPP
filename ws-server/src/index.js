import dotenv from 'dotenv'; import jwt from 'jsonwebtoken'; import {WebSocketServer} from 'ws'; import Redis from 'ioredis'; import mysql from 'mysql2/promise';
dotenv.config();
const port=Number(process.env.WS_PORT||4001);
const wss=new WebSocketServer({port});
const pub=new Redis(process.env.REDIS_URL); const sub=new Redis(process.env.REDIS_URL);
const db=mysql.createPool({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,connectionLimit:5});
const sockets=new Map();
const channel='phonechat:messages';
sub.subscribe(channel);
sub.on('message',(_channel,raw)=>{const msg=JSON.parse(raw);for(const ws of sockets.get(Number(msg.receiverId))||[])if(ws.readyState===1)ws.send(JSON.stringify({type:'message',message:msg}));});
wss.on('connection',(ws,req)=>{
  try{
    const url=new URL(req.url,'http://localhost');const token=url.searchParams.get('token');
    const user=jwt.verify(token,process.env.JWT_SECRET);ws.userId=Number(user.id);
    if(!sockets.has(ws.userId))sockets.set(ws.userId,new Set());sockets.get(ws.userId).add(ws);
    ws.send(JSON.stringify({type:'connected',userId:ws.userId}));
  }catch{ws.close(1008,'Unauthorized');return;}
  ws.on('message',async raw=>{
    try{
      const data=JSON.parse(raw.toString());if(data.type!=='message')return;
      const receiverId=Number(data.receiverId);const body=String(data.body||'').trim();
      if(!Number.isSafeInteger(receiverId)||receiverId<1||!body||body.length>4000)return;
      const [result]=await db.execute('INSERT INTO messages(sender_id,receiver_id,body) VALUES(?,?,?)',[ws.userId,receiverId,body]);
      const message={id:result.insertId,senderId:ws.userId,receiverId,body,createdAt:new Date().toISOString()};
      await pub.publish(channel,JSON.stringify(message));
      for(const client of sockets.get(ws.userId)||[])if(client.readyState===1)client.send(JSON.stringify({type:'message',message}));
    }catch(err){console.error('WS message error',err);}
  });
  ws.on('close',()=>{sockets.get(ws.userId)?.delete(ws);if(!sockets.get(ws.userId)?.size)sockets.delete(ws.userId);});
});
console.log(`WebSocket server listening on ${port}`);
