import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendQuest } from '../server/quests.js';
import { scoreSkills } from '../server/analyzer.js';

test('generates a code-verifiable quest from the weakest skill', () => {
  const skills=scoreSkills([{repo:'DustGuard',path:'api/routes/chat.py',url:'https://github.com/example/DustGuard/blob/abc/api/routes/chat.py',commitSha:'abc',pushedAt:new Date().toISOString(),content:'from fastapi import APIRouter\nrouter=APIRouter()\n@router.get("/api/v1/items")\nasync def items(): return []'}]);
  const quest=recommendQuest({profile:{login:'example',name:'Example'},scannedAt:new Date().toISOString(),filesInspected:1,repositories:[{name:'DustGuard',fullName:'example/DustGuard',url:'https://github.com/example/DustGuard',language:'Python',pushedAt:new Date().toISOString(),defaultBranch:'main',headSha:'abc'}],skills,aiReview:{used:false,model:'rules'}});
  assert.equal(quest.status,'proposed');
  assert.equal(quest.repositoryFullName,'example/DustGuard');
  assert.equal(quest.baselineSha,'abc');
  assert.ok(quest.objectives.length > 0);
  assert.ok(quest.objectives.every(objective=>objective.capability&&objective.xp>0));
});
