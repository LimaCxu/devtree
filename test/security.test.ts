import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { resolveAppUrl } from '../server/api.js';
import { assertSafeAiEndpoint } from '../server/ollama.js';
import { buildPublicPassport } from '../server/passport.js';
import type { AnalysisResult, Skill } from '../shared/types.js';

const request=(host:string)=>({headers:{host}} as IncomingMessage);

test('OAuth origin uses configured APP_URL and rejects unconfigured remote hosts',()=>{
  assert.equal(resolveAppUrl(request('attacker.example'),'https://devtree.example'),'https://devtree.example');
  assert.throws(()=>resolveAppUrl(request('attacker.example'),'https://devtree.example/path'),/valid HTTP\(S\) origin/);
  assert.equal(resolveAppUrl(request('localhost:4317'),undefined),'http://localhost:4317');
  assert.throws(()=>resolveAppUrl(request('attacker.example'),undefined),/APP_URL must be configured/);
});

test('AI endpoints are restricted to safe providers and explicit server allowlists',()=>{
  assert.equal(assertSafeAiEndpoint('ollama','http://127.0.0.1:11434'),'http://127.0.0.1:11434');
  assert.equal(assertSafeAiEndpoint('openai-compatible','https://api.openai.com/v1'),'https://api.openai.com/v1');
  assert.equal(assertSafeAiEndpoint('openai-compatible','https://models.example/v1','models.example'),'https://models.example/v1');
  assert.throws(()=>assertSafeAiEndpoint('ollama','http://169.254.169.254/latest'),/not allowed/);
  assert.throws(()=>assertSafeAiEndpoint('openai-compatible','http://api.openai.com/v1'),/require HTTPS/);
  assert.throws(()=>assertSafeAiEndpoint('ollama','http://user:secret@localhost:11434'),/must not contain credentials/);
});

function skill(evidence:Skill['evidence']):Skill{return{title:'FastAPI',level:8,score:80,confidence:90,capabilities:[['✓','Async API']],repositoryCount:2,evidenceScore:10,evidence,reason:'PrivateProject and PublicProject prove Level 8.',next:'Add testing.'}}

test('public passport removes every private repository reference',()=>{
  const result:AnalysisResult={profile:{login:'liam',name:'Liam',repositoryCount:2},scannedAt:'2026-08-29T00:00:00Z',filesInspected:2,repositories:[
    {name:'PublicProject',fullName:'liam/PublicProject',url:'https://github.com/liam/PublicProject',language:'TypeScript',pushedAt:'2026-08-29T00:00:00Z',defaultBranch:'main',private:false},
    {name:'SecretProject',fullName:'liam/SecretProject',url:'https://github.com/liam/SecretProject',language:'Python',pushedAt:'2026-08-29T00:00:00Z',defaultBranch:'main',private:true}
  ],skills:{python:skill([]),fastapi:skill([
    {capability:'Async API',repository:'liam/PublicProject',path:'src/api.ts',line:1,summary:'public',url:'https://github.com/liam/PublicProject/blob/a/src/api.ts',strength:1,sourceKind:'production'},
    {capability:'Authentication',repository:'liam/SecretProject',path:'secret/auth.py',line:1,summary:'private',url:'https://github.com/liam/SecretProject/blob/a/secret/auth.py',strength:1,sourceKind:'production'}
  ]),api:skill([]),llm:skill([]),testing:skill([]),database:skill([]),rag:skill([]),agents:skill([]),evaluation:skill([])},aiReview:{used:true,model:'test'}};
  const passport=buildPublicPassport(result,320);
  const serialized=JSON.stringify(passport);
  assert.equal(passport.profile.repositoryCount,1);
  assert.equal(passport.skills.fastapi.evidence.length,1);
  assert.doesNotMatch(serialized,/SecretProject|secret\/auth\.py/);
  assert.match(passport.skills.fastapi.reason,/public code evidence/);
});
