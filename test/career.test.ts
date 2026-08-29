import assert from 'node:assert/strict';
import test from 'node:test';
import { generateCareerTarget } from '../server/career.js';
import type { AnalysisResult, Skill, SkillKey } from '../shared/types.js';

function skill(title:string,score:number):Skill{return{title,level:Math.floor(score/10),score,confidence:80,capabilities:[],repositoryCount:1,evidenceScore:score,evidence:[],reason:'',next:''}}
function result():AnalysisResult{const scores:Record<SkillKey,number>={python:82,fastapi:62,api:60,llm:66,testing:30,database:55,rag:44,agents:25,evaluation:10};return{profile:{login:'liam',name:'Liam'},scannedAt:new Date().toISOString(),filesInspected:12,repositories:[],skills:Object.fromEntries(Object.entries(scores).map(([key,score])=>[key,skill(key.toUpperCase(),score)])) as Record<SkillKey,Skill>,aiReview:{used:false,model:'rules'}}}

test('builds a weighted career gap and 12-week roadmap from code evidence',()=>{
  const target=generateCareerTarget(result(),'Senior Agent Engineer','Build reliable agents with evaluation and RAG.');
  assert.ok(target.readiness>0&&target.readiness<100);
  assert.equal(target.roadmap.length,3);
  assert.deepEqual(target.roadmap.map(item=>item.weeks),['1–4','5–8','9–12']);
  assert.equal(target.gaps[0]?.skillKey,'evaluation');
  assert.ok(target.gaps.every(item=>item.gap===Math.max(0,item.target-item.current)));
});
