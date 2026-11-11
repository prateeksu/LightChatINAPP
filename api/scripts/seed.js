import dotenv from 'dotenv'; import bcrypt from 'bcryptjs'; import {pool} from '../src/db.js'; dotenv.config();
const hash=await bcrypt.hash('demo123',12);
for(const u of [{phone:'+919876543210',name:'Aarav Sharma'},{phone:'+919876543211',name:'Priya Verma'},{phone:'+919876543212',name:'Rahul Singh'}]){
 await pool.execute('INSERT INTO users(phone,name,password_hash) VALUES(?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),password_hash=VALUES(password_hash)',[u.phone,u.name,hash]);
}
await pool.end(); console.log('Seed users ready. Password: demo123');
