import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function localStore(path='work/guardian.sqlite'){
 mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);
 for(const f of ['0001_monitor.sql','0002_rate_limits.sql','0003_service_deliveries.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 function prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}
 return {prepare,async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},close(){db.close();}};
}
