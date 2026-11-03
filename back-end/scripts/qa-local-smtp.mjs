import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve('../qa-local/mail.jsonl');
net.createServer(socket=>{
 socket.write('220 qa-local ESMTP\r\n');
 let buffer='', data=false, message='', auth=0;
 socket.on('data',chunk=>{buffer+=chunk; let idx;
  while((idx=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,idx);buffer=buffer.slice(idx+2);
   if(data){ if(line==='.') {fs.appendFileSync(out,JSON.stringify({at:new Date().toISOString(),message})+'\n');data=false;message='';socket.write('250 Captured\r\n');}else message+=line+'\n';continue;}
   if(auth){auth--;socket.write(auth?'334 UGFzc3dvcmQ6\r\n':'235 Authenticated\r\n');continue;}
   if(/^EHLO|^HELO/i.test(line))socket.write('250-localhost\r\n250 AUTH PLAIN LOGIN\r\n');
   else if(/^AUTH LOGIN/i.test(line)){auth=2;socket.write('334 VXNlcm5hbWU6\r\n');}
   else if(/^AUTH PLAIN/i.test(line))socket.write('235 Authenticated\r\n');
   else if(/^DATA/i.test(line)){data=true;socket.write('354 Send content\r\n');}
   else if(/^QUIT/i.test(line)){socket.end('221 Bye\r\n');}
   else socket.write('250 OK\r\n');
  }
 });
}).listen(1025,'127.0.0.1',()=>console.log('QA SMTP capture listening on 127.0.0.1:1025'));
