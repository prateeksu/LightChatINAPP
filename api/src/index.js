import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { auth } from './auth.js';
dotenv.config();
const app=express();
app.use(cors({origin:process.env.CLIENT_ORIGIN,credentials:true}));
app.use(express.json({limit:'20kb'}));
app.get('/api/health',(_req,res)=>res.json({success:true,service:'phonechat-api'}));

app.post('/api/auth/login',async(req,res)=>{
  try{
    const {phone,password}=req.body||{};
    if(!phone||!password)return res.status(400).json({success:false,message:'Phone and password required'});
    const [rows]=await pool.execute('SELECT id,phone,name,password_hash FROM users WHERE phone=?',[phone]);
    const user=rows[0];
    if(!user||!(await bcrypt.compare(password,user.password_hash)))return res.status(401).json({success:false,message:'Invalid phone or password'});
    const token=jwt.sign({id:user.id,phone:user.phone},process.env.JWT_SECRET,{expiresIn:'2h'});
    res.json({success:true,token,user:{id:user.id,phone:user.phone,name:user.name}});
  }catch(e){console.error(e);res.status(500).json({success:false,message:'Server error'});}
});

app.get('/api/users/search',auth,async(req,res)=>{
  try{
    const q=String(req.query.q||'').trim();
    if(q.length<2)return res.json({success:true,users:[]});
    const like=`%${q}%`;
    const [rows]=await pool.execute('SELECT id,phone,name FROM users WHERE id<>? AND (phone LIKE ? OR name LIKE ?) LIMIT 20',[req.user.id,like,like]);
    res.json({success:true,users:rows});
  }catch(e){console.error(e);res.status(500).json({success:false,message:'Search failed'});}
});

app.get('/api/chats/:userId/messages',auth,async(req,res)=>{
  try{
    const other=Number(req.params.userId);
    if(!Number.isSafeInteger(other)||other<1)return res.status(400).json({success:false,message:'Invalid user'});
    const [rows]=await pool.execute(
      `SELECT id,sender_id AS senderId,receiver_id AS receiverId,body,created_at AS createdAt
       FROM messages WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
       ORDER BY id DESC LIMIT 100`,[req.user.id,other,other,req.user.id]);
    res.json({success:true,messages:rows.reverse()});
  }catch(e){console.error(e);res.status(500).json({success:false,message:'History failed'});}
});
const port=process.env.PORT||4000;
app.listen(port,()=>console.log(`REST API listening on ${port}`));
