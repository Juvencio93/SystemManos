import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createTestDatabase,ids } from '../test-rb-inventory.mjs';

export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),
  resolve:{alias:{'@':fileURLToPath(new URL('../../src',import.meta.url))}},
  server:{host:'127.0.0.1',port:3011,strictPort:true},plugins:[react(),tailwind(),{
    name:'isolated-rb-postgres-preview',
    async configureServer(server) {
      const db=await createTestDatabase();let online=true;
      await db.exec(`update hotspot_devices set inventory_label='001' where id='${ids.device}'`);
      server.httpServer?.on('close',()=>void db.close());
      server.middlewares.use('/local-api',async(req,res)=>{
        res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');
        try {
          if(req.headers.origin && req.headers.origin!=='http://127.0.0.1:3011')throw Error('Invalid origin');
          const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)throw Error('Body too large');chunks.push(chunk);}
          const body=chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
          if(online)await db.exec(`update hotspot_devices set last_seen_at=now() where id='${ids.device}'`);
          if(req.url==='/inventory' && req.method==='GET') {
            const devices=(await db.query('select * from hotspot_devices order by router_identity')).rows;
            const targets=(await db.query(`select h.id,h.company_id as "companyId",h.branch_id as "branchId",c.name||' · Matriz' as label from hotspot_configs h join companies c on c.id=h.company_id`)).rows;
            res.end(JSON.stringify({devices,targets,resellers:[{id:ids.owner,name:'Revenda demonstração'},{id:ids.outsider,name:'Outra revenda'}]}));return;
          }
          if(req.method!=='POST')throw Error('Method not allowed');
          if(req.url==='/action')await db.query('select manage_hotspot_inventory($1,$2,$3,$4,$5,$6,$7,$8)',[ids.admin,body.action,body.deviceId??null,body.expectedVersion??null,body.configId??null,body.label??null,body.action==='create' ? 'MT-'+randomUUID().replaceAll('-','').slice(0,16).toUpperCase():null,body.resellerId??null]);
          else if(req.url==='/simulate') {
            const d=(await db.query('select * from hotspot_devices where id=$1',[ids.device])).rows[0];
            if(body.step==='offline'){online=false;await db.exec(`update hotspot_devices set last_seen_at=now()-interval '1 hour' where id='${ids.device}'`);}
            else if(body.step==='online'){online=true;await db.exec(`update hotspot_devices set last_seen_at=now() where id='${ids.device}'`);}
            else if(body.step==='ack'){if(!online)throw Error('A RB está offline. Simule o retorno à internet primeiro.');await db.query('select ack_hotspot_assignment($1,$2)',[d.router_identity,d.assignment_version]);}
            else if(body.step==='radius'){
              const username='mt_'+randomUUID();
              await db.query(`insert into hotspot_access_grants(device_id,assignment_version,company_id,portal_target_id,portal_target_kind,username,expires_at,pending_checkin) values($1,$2,$3,$4,$5,$6,now()+interval '10 minutes','{}')`,[d.id,d.assignment_version,d.company_id,d.branch_id??d.company_id,d.branch_id?'branch':'company',username]);
              const result=await db.query('select validate_hotspot_assignment($1,$2) as ok',[d.router_identity,username]);if(!result.rows[0].ok)throw Error('Check-in recusado. Aguarde a confirmação da RB.');
            }else throw Error('Unknown simulation');
          }else throw Error('Not found');
          res.end(JSON.stringify({ok:true}));
        }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}
      });
    },
  }],
});
