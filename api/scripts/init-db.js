import fs from 'node:fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
const conn=await mysql.createConnection({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,multipleStatements:true});
const sql=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');
await conn.query(sql); await conn.end(); console.log('Database schema initialized.');
