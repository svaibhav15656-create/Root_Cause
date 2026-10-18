const crypto=require('node:crypto');
const {deliver}=require('./notifier');

function evidence(row){return {timestamp:row.event_at,level:row.level,service:row.service,message:row.message};}
async function addWarning(pool,app,pattern,title,cause,steps,confidence,rows){
  const recent=await pool.query("SELECT id FROM incidents WHERE app_id=$1 AND pattern_code=$2 AND created_at>now()-interval '30 minutes' LIMIT 1",[app.id,pattern]);if(recent.rowCount)return null;
  const incident={id:crypto.randomUUID(),tenantId:app.tenant_id,appId:app.id,type:'warning',patternCode:pattern,signature:`${app.id}:${pattern}`,severity:'warning',status:'open',title,cause,steps,confidence,evidence:rows.slice(-8).map(evidence),createdAt:new Date()};
  const q=await pool.query(`INSERT INTO incidents(id,tenant_id,app_id,type,pattern_code,signature,severity,status,title,cause,steps,confidence,evidence)
    VALUES($1,$2,$3,'warning',$4,$5,'warning','open',$6,$7,$8,$9,$10) RETURNING id,created_at`,[incident.id,app.tenant_id,app.id,pattern,incident.signature,title,cause,JSON.stringify(steps),confidence,JSON.stringify(incident.evidence)]);
  incident.createdAt=q.rows[0].created_at;incident.appName=app.name;void deliver(pool,incident);return incident;
}
async function analyzeApp(pool,app){
  const q=await pool.query(`SELECT event_at,level,service,message,duration_ms FROM logs WHERE app_id=$1 AND event_at>now()-interval '30 minutes' ORDER BY event_at ASC`,[app.id]);
  const now=Date.now(),cut=now-15*60_000;const previous=q.rows.filter(x=>new Date(x.event_at).getTime()<cut);const current=q.rows.filter(x=>new Date(x.event_at).getTime()>=cut);
  const latency=x=>/database|\bdb\b|query|sql/i.test(`${x.service} ${x.message}`)&&((x.duration_ms||0)>=500||/latency|slow query/i.test(x.message));
  const retries=x=>/retry|retrying|timeout|timed out|connection refused/i.test(x.message);
  const memory=x=>/out of memory|heap|memory pressure|gc pause|garbage collection/i.test(x.message);
  const count=(rows,fn)=>rows.filter(fn).length;const curLat=count(current,latency),oldLat=count(previous,latency),curRetry=count(current,retries),oldRetry=count(previous,retries);
  if(curLat>=3&&curRetry>=2&&curLat>oldLat&&curRetry>oldRetry){await addWarning(pool,app,'db_latency_retries','Database latency and retries are rising together','The database may be slowing down while requests retry. This can exhaust the connection pool if the pattern continues.',['Check database latency, connection limits, and active connections.','Inspect retry counts and use backoff with a maximum attempt limit.','Check for a slow query or a recent traffic or deploy change.'],'Medium',current.filter(x=>latency(x)||retries(x)));}
  if(curRetry>=5&&curRetry>=Math.max(3,oldRetry*2)){await addWarning(pool,app,'retry_spike','Retries and timeouts have increased','Repeated attempts can add load to a dependency that is already struggling.',['Check which dependency is timing out.','Use bounded retries with exponential backoff and jitter.','Check whether the first failure began after a deploy.'],'Low',current.filter(retries));}
  const curErrors=count(current,x=>['ERROR','FATAL'].includes(x.level)),oldErrors=count(previous,x=>['ERROR','FATAL'].includes(x.level));if(curErrors>=5&&curErrors>=Math.max(3,oldErrors*2)){await addWarning(pool,app,'error_rate_spike','Application errors are increasing quickly','A sudden increase in errors may indicate a failing dependency, a recent change, or a traffic-related issue.',['Group the new error types and check whether they share a service.','Review recent deployments and dependency health.','Check whether the error rate tracks a traffic spike.'],'Medium',current.filter(x=>['ERROR','FATAL'].includes(x.level)));}
  const curMem=count(current,memory),oldMem=count(previous,memory);if(curMem>=3&&curMem>oldMem){await addWarning(pool,app,'memory_pressure','Memory and garbage-collection warnings are increasing','Memory pressure may lead to slower responses or a process restart.',['Compare memory use with normal traffic.','Inspect recent changes to caches, queues, and payload sizes.','Capture a heap profile and verify the process memory limit.'],'Medium',current.filter(memory));}
  if(previous.length>=5&&current.length===0){await addWarning(pool,app,'log_silence','Log activity stopped unexpectedly','This app sent logs in the previous window but has gone quiet. It may be idle, disconnected, or unavailable.',['Check whether the service is healthy and receiving traffic.','Verify the log forwarder and app key are still active.','Confirm whether this quiet period is expected.'],'Low',previous.slice(-8));}
}
async function judgeOutcomes(pool){
  await pool.query(`INSERT INTO warning_outcomes(incident_id,followed_by_real_error,lead_time_minutes,judged_at)
    SELECT w.id, EXISTS(SELECT 1 FROM incidents e WHERE e.app_id=w.app_id AND e.type='error' AND e.created_at>w.created_at AND e.created_at<=w.created_at+interval '60 minutes'),
    (SELECT floor(extract(epoch FROM (e.created_at-w.created_at))/60)::int FROM incidents e WHERE e.app_id=w.app_id AND e.type='error' AND e.created_at>w.created_at AND e.created_at<=w.created_at+interval '60 minutes' ORDER BY e.created_at LIMIT 1),now()
    FROM incidents w LEFT JOIN warning_outcomes o ON o.incident_id=w.id
    WHERE w.type='warning' AND o.incident_id IS NULL AND w.created_at<now()-interval '60 minutes'
    ON CONFLICT(incident_id) DO NOTHING`);
}
async function prune(pool){await pool.query(`WITH expired AS (
    SELECT l.ctid FROM logs l JOIN tenants t ON t.id=l.tenant_id JOIN plans p ON p.code=t.plan
    WHERE l.event_at<now()-p.retention_days*interval '1 day' ORDER BY l.event_at LIMIT 5000
  ) DELETE FROM logs l USING expired e WHERE l.ctid=e.ctid`);await pool.query("DELETE FROM sessions WHERE expires_at<now()");await pool.query("DELETE FROM anonymous_explanation_usage WHERE usage_date<current_date-2");}
async function runAnalyzer(pool){
  let locked=false;const client=await pool.connect();
  try{const l=await client.query('SELECT pg_try_advisory_lock(82731492) AS locked');locked=l.rows[0].locked;if(!locked)return;
    const apps=await pool.query('SELECT id,tenant_id,name FROM apps WHERE deleted_at IS NULL');
    for(const app of apps.rows){try{await analyzeApp(pool,app)}catch(error){console.error(`Analyzer failed for app ${app.id}:`,error.message)}}
    await judgeOutcomes(pool);await prune(pool);
  }finally{if(locked)await client.query('SELECT pg_advisory_unlock(82731492)').catch(()=>{});client.release();}
}
module.exports={runAnalyzer,judgeOutcomes};
