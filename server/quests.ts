import type { AnalysisResult, Quest, QuestObjective, SkillKey } from '../shared/types.js';
import { acceptedQuestsForUser, completeQuest } from './db.js';

const questNames: Record<SkillKey,string> = { python:'The Python Forge',fastapi:'The API Citadel',api:'The Contract Trial',llm:'The Model Workshop',testing:'The Testing Dungeon',database:'The Data Vault',rag:'The Retrieval Labyrinth',agents:'The Agent Arena',evaluation:'The Evaluation Gauntlet' };

export function recommendQuest(result: AnalysisResult): Quest {
  const ranked=(Object.entries(result.skills) as Array<[SkillKey,AnalysisResult['skills'][SkillKey]]>).filter(([,skill])=>skill.level<8).sort((a,b)=>a[1].evidenceScore-b[1].evidenceScore);
  const [skillKey,skill]=ranked[0]||(['testing',result.skills.testing] as const);
  const missing=skill.capabilities.filter(([state])=>state!=='✓').slice(0,4).map(([,name])=>name);
  const capabilities=missing.length?missing:skill.capabilities.slice(0,4).map(([,name])=>name);
  const repository=result.repositories[0];
  const objectives:QuestObjective[]=capabilities.map((capability,index)=>({id:`${skillKey}-${index}`,label:`Add verifiable ${capability} implementation`,capability,xp:index===0?100:80,completed:false}));
  return {skillKey,title:questNames[skillKey],description:`Strengthen ${skill.title} with code evidence that can be verified after your next push.`,repositoryFullName:repository?.fullName||`${result.profile.login}/${repository?.name||'choose-a-repository'}`,baselineSha:repository?.headSha,rewardXp:objectives.reduce((sum,item)=>sum+item.xp,0),status:'proposed',objectives};
}

async function githubCompare(token:string,repository:string,baseline:string,head:string):Promise<Set<string>>{
  const response=await fetch(`https://api.github.com/repos/${repository}/compare/${baseline}...${head}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'DEVTREE'}});
  if(!response.ok)return new Set();
  const data=await response.json() as {files?:Array<{filename:string}>};
  return new Set((data.files||[]).map(file=>file.filename));
}

export async function verifyAcceptedQuests(githubId:string|number,token:string,result:AnalysisResult):Promise<void>{
  const quests=await acceptedQuestsForUser(githubId);
  for(const quest of quests){
    const repository=result.repositories.find(item=>item.fullName===quest.repositoryFullName);
    if(!repository?.headSha||!quest.baselineSha||repository.headSha===quest.baselineSha)continue;
    const changed=await githubCompare(token,quest.repositoryFullName,quest.baselineSha,repository.headSha);
    const skill=result.skills[quest.skillKey as SkillKey];
    if(!skill)continue;
    const objectives=(quest.objectives as QuestObjective[]).map(objective=>{
      if(objective.completed)return objective;
      const evidence=skill.evidence.find(item=>item.capability===objective.capability&&(item.repository===repository.fullName||item.repository===repository.name)&&changed.has(item.path)&&item.strength>=60);
      return evidence?{...objective,completed:true,evidenceUrl:evidence.url}:objective;
    });
    if(objectives.every(item=>item.completed))await completeQuest(quest.id,objectives);
  }
}
