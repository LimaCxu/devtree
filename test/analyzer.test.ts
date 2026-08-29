import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSkills } from '../server/analyzer.js';
import { decrypt, encrypt } from '../server/db.js';

const files = [
  {
    repo: 'DustGuard', path: 'api/routes/chat.py', url: 'https://github.com/example/DustGuard/blob/main/api/routes/chat.py',
    content: `from fastapi import APIRouter, Depends\nfrom fastapi.responses import StreamingResponse\nrouter = APIRouter(prefix="/api/v1")\n@router.post("/chat")\nasync def chat(user = Depends(current_user)):\n    return StreamingResponse(stream())`
  },
  {
    repo: 'DustGuard', path: 'tests/test_chat.py', url: 'https://github.com/example/DustGuard/blob/main/tests/test_chat.py',
    content: `import pytest\nfrom fastapi.testclient import TestClient\n@pytest.fixture\ndef client(): pass\ndef test_chat(client): pass`
  },
  {
    repo: 'PaperPilot', path: 'retrieval/index.py', url: 'https://github.com/example/PaperPilot/blob/main/retrieval/index.py',
    content: `async def index_documents():\n    chunks = text_splitter.split_documents(docs)\n    embeddings = embed_documents(chunks)\n    return vector_store.similarity_search("query")`
  }
];

test('assigns levels only when code patterns are present', () => {
  const skills = scoreSkills(files);
  assert.ok(skills.fastapi.level >= 4);
  assert.ok(skills.testing.level >= 1);
  assert.ok(skills.rag.level >= 2);
  assert.equal(skills.evaluation.level, 0);
});

test('attaches inspectable repository, file and line evidence', () => {
  const evidence = scoreSkills(files).fastapi.evidence[0];
  assert.equal(evidence.repository, 'DustGuard');
  assert.match(evidence.path, /chat\.py$/);
  assert.ok(evidence.line > 0);
  assert.match(evidence.url, /^https:\/\/github\.com\//);
  assert.ok(evidence.strength >= 50);
  assert.equal(evidence.sourceKind, 'production');
});

test('does not treat imports or production files as testing mastery', () => {
  const skills = scoreSkills([{ repo:'ImportsOnly', path:'src/client.py', url:'https://github.com/example/imports', content:'import pytest\nfrom openai import OpenAI' }]);
  assert.equal(skills.testing.level, 0);
  assert.equal(skills.llm.level, 0);
});

test('deduplicates repeated capability evidence within one repository', () => {
  const duplicate = files[0];
  const skills = scoreSkills([duplicate, { ...duplicate, path:'api/routes/chat_copy.py' }]);
  assert.ok(skills.fastapi.repositoryCount <= 1);
});

test('returns fog-of-war nodes when no evidence exists', () => {
  const skills = scoreSkills([]);
  for (const skill of Object.values(skills)) {
    assert.equal(skill.level, 0);
    assert.equal(skill.evidence.length, 0);
  }
});

test('encrypts OAuth tokens before persistence', () => {
  process.env.TOKEN_ENCRYPTION_KEY = 'test-only-encryption-key';
  const encrypted = encrypt('github-token-value');
  assert.notEqual(encrypted, 'github-token-value');
  assert.equal(decrypt(encrypted), 'github-token-value');
});
