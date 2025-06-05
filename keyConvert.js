const fs=require('fs')
const key=fs.readFileSync('./job-portal-5953b-firebase-adminsdk-fbsvc-7a1987e550.json','utf-8')
const base64=Buffer.from(key).toString('base64')
console.log(base64);