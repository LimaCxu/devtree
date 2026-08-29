import type { AnalysisResult, PublicPassport } from '../shared/types.js';

export function buildPublicPassport(result:AnalysisResult,xp:number):PublicPassport{
  const repositories=result.repositories.filter(repository=>repository.private===false);
  const allowed=new Set(repositories.flatMap(repository=>[repository.name,repository.fullName]));
  const skills=Object.fromEntries(Object.entries(result.skills).map(([key,skill])=>{
    const evidence=skill.evidence.filter(item=>allowed.has(item.repository));
    return [key,{...skill,evidence,repositoryCount:new Set(evidence.map(item=>item.repository)).size,reason:evidence.length?`Level ${skill.level} is supported by ${evidence.length} public code evidence item${evidence.length===1?'':'s'}.`:'No public code evidence is available for this skill.'}];
  })) as AnalysisResult['skills'];
  return {public:true,profile:{...result.profile,repositoryCount:repositories.length,xp},scannedAt:result.scannedAt,skills,repositories:repositories.map(repository=>({name:repository.name,url:repository.url,language:repository.language})),aiVerified:result.aiReview.used};
}
