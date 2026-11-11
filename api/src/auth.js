import jwt from 'jsonwebtoken';
export function auth(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({success:false,message:'Missing token'});
  try { req.user=jwt.verify(token,process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({success:false,message:'Invalid or expired token'}); }
}
