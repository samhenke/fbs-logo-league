const $ = id => document.getElementById(id);
const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b; };
let teams=[],round=[],index=0,score=0,streak=0,answered=false,missed=[],options=[],activeMode='choice',activeConference='All',isPractice=false;
let roundSeed=0,roundChallenge=false,opponentScore=null,pendingChallenge=null;
let record={seen:[],nicknames:[],helmets:[],attempts:0,correct:0,best:0};
try {const r=JSON.parse(localStorage.getItem('logo-league-record-v1'));if(r&&Array.isArray(r.seen)&&Number.isFinite(r.attempts)&&Number.isFinite(r.correct)&&Number.isFinite(r.best))record={...r,nicknames:Array.isArray(r.nicknames)?r.nicknames:[],helmets:Array.isArray(r.helmets)?r.helmets:[]};}catch{}
function save(){try{localStorage.setItem('logo-league-record-v1',JSON.stringify(record));}catch{}updateStats();}
function questionNoun(mode=activeMode){return mode==='nickname'?'nickname':mode==='helmet'?'helmet':'logo';}
function promptImage(team){return activeMode==='helmet'?team.helmet:team.logo;}
function updateStats(){
 const known=activeMode==='nickname'?record.nicknames:activeMode==='helmet'?record.helmets:record.seen;
 $('mastered').innerHTML=`${new Set(known).size}<span>/138</span>`;
 $('masteredLabel').textContent=activeMode==='nickname'?'Unique nicknames recalled':activeMode==='helmet'?'Unique helmets identified':'Unique logos identified';
 $('accuracy').textContent=record.attempts?Math.round(record.correct/record.attempts*100)+'%':'—';$('bestStreak').textContent=record.best;
}
function startRound(pool=null,challenge=null){
 activeConference=$('conference').value;activeMode=challenge?challenge.m:$('mode').value;isPractice=!!pool;
 roundChallenge=!pool&&(!!challenge||$('challengeMode').checked);opponentScore=challenge?challenge.score:null;roundSeed=challenge?challenge.s:crypto.getRandomValues(new Uint32Array(1))[0];pendingChallenge=null;
 const field=pool||teams.filter(t=>activeConference==='All'||t.conference===activeConference);
 const amount=pool?field.length:$('length').value==='all'?field.length:Math.min(Number($('length').value),field.length);
 round=challenge?challenge.t.map(id=>teams.find(t=>t.id===id)):shuffle(field).slice(0,amount);index=score=streak=0;missed=[];
 $('roundLabel').textContent=(isPractice?'MISSED '+questionNoun().toUpperCase()+'S':roundChallenge?'FRIEND CHALLENGE':activeConference==='All'?'ALL FBS':activeConference.toUpperCase())+' · '+(isPractice?'PRACTICE':round.length+' '+questionNoun().toUpperCase()+(round.length===1?'':'S'));
 $('challengeInvitation').hidden=true;$('questionView').hidden=false;$('resultsView').hidden=true;showView('play');updateStats();renderQuestion();
}
function seededRandom(seed){let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)>>>0;let v=state;v=Math.imul(v^(v>>>15),v|1);v^=v+Math.imul(v^(v>>>7),v|61);return ((v^(v>>>14))>>>0)/4294967296;};}
function seededShuffle(values,random){const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function questionOptions(team,questionIndex,seed,field){
 const random=seededRandom((seed^Math.imul(questionIndex+1,0x9E3779B1))>>>0);
 const same=field.filter(t=>t.id!==team.id&&t.conference===team.conference);
 const others=seededShuffle(same.length>=3?same:field.filter(t=>t.id!==team.id),random).slice(0,3);
 return seededShuffle([team,...others],random);
}
function encodeChallenge(payload){return btoa(JSON.stringify(payload)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function decodeChallenge(hash,field){
 const token=new URLSearchParams(hash.replace(/^#/, '')).get('challenge');if(!token)return null;
 if(token.length>5000||!/^[A-Za-z0-9_-]+$/.test(token))throw Error('Invalid challenge');
 const payload=JSON.parse(atob(token.replace(/-/g,'+').replace(/_/g,'/')));const ids=new Set(field.map(t=>t.id));
 if(payload.v!==1||!Array.isArray(payload.t)||!payload.t.length||payload.t.length>field.length||new Set(payload.t).size!==payload.t.length||payload.t.some(id=>typeof id!=='string'||!ids.has(id))||!['choice','type','nickname','helmet'].includes(payload.m)||!Number.isInteger(payload.s)||payload.s<0||payload.s>4294967295||!Number.isInteger(payload.score)||payload.score<0||payload.score>payload.t.length)throw Error('Invalid challenge');
 return {v:1,t:payload.t,m:payload.m,s:payload.s,score:payload.score};
}
function challengeURL(base,payload){const url=new URL(base);url.search='';url.hash='challenge='+encodeChallenge(payload);return url.href;}
function canShareChallenge(base){const url=new URL(base);return ['https:','http:'].includes(url.protocol)&&!['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname);}
function modeLabel(mode){return {choice:'Logo → multiple choice',type:'Logo → type the team',nickname:'School → nickname',helmet:'Helmet → school'}[mode];}
function showChallengeInvitation(challenge){
 pendingChallenge=challenge;$('questionView').hidden=true;$('resultsView').hidden=true;$('challengeInvitation').hidden=false;$('roundLabel').textContent='FRIEND CHALLENGE';
 $('challengeInvitation').innerHTML=`<div class="eyebrow">SAME QUIZ. YOUR TURN.</div><h2>You’ve been challenged.</h2><div class="target-score">${challenge.score}<span> / ${challenge.t.length}</span></div><p>Your friend’s score to beat.<br>${challenge.t.length} ${challenge.m==='nickname'?'school':questionNoun(challenge.m)}${challenge.t.length===1?'':'s'} · ${modeLabel(challenge.m)}<br>Same teams. Same order. Same game mode.</p><button class="primary" id="acceptChallenge">Take the challenge →</button>`;
 $('acceptChallenge').addEventListener('click',()=>startRound(null,challenge));$('mode').value=challenge.m;$('challengeMode').checked=true;updatePlayStyle();
}
function handleChallengeURL(){try{const challenge=decodeChallenge(location.hash,teams);if(challenge){showChallengeInvitation(challenge);return true;}}catch{ $('challengeNote').hidden=false;$('challengeNote').textContent='That challenge link is invalid. You can start a new round instead.';}return false;}
function updatePlayStyle(){$('challengeNote').hidden=!$('challengeMode').checked;$('start').innerHTML=($('challengeMode').checked?'Start my challenge':'Start a new round')+' <span>→</span>';}
function addChallengeResult(){
 const section=document.createElement('section');section.className='challenge-result';
 if(opponentScore!==null){const heading=document.createElement('h3');heading.textContent=score>opponentScore?'You won by '+(score-opponentScore)+'!':score===opponentScore?'It’s a tie!':'Your friend won by '+(opponentScore-score)+'.';const summary=document.createElement('p');summary.textContent='Your score: '+score+' · Your friend: '+opponentScore;section.append(heading,summary);}
 const title=document.createElement('h3');title.textContent=opponentScore!==null?'Send this round back':'Challenge your friend';section.append(title);
 const message=document.createElement('p');message.textContent='This link gives your friend the same teams, order, and game mode'+(activeMode==='choice'?', including the same answer options':'')+', with your score to beat.';section.append(message);
 if(canShareChallenge(location.href)){
  const payload={v:1,t:round.map(t=>t.id),m:activeMode,s:roundSeed,score};const url=challengeURL(location.href,payload);
  const label=document.createElement('label');label.textContent='Your challenge link';label.htmlFor='challengeLink';
  const link=document.createElement('input');link.id='challengeLink';link.type='url';link.readOnly=true;link.value=url;link.addEventListener('click',()=>link.select());
  const copy=document.createElement('button');copy.type='button';copy.className='primary';copy.textContent='Copy challenge link →';
  const status=document.createElement('p');status.className='share-status';status.setAttribute('role','status');
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url);status.textContent='Copied! Send the link to your friend.';}catch{link.focus();link.select();status.textContent='Select and copy the link above to send it to your friend.';}});
  section.append(label,link,copy,status);
 }else{const note=document.createElement('p');note.className='share-status';note.textContent='Shareable links are available on the live website. This local preview lets you try the challenge flow.';section.append(note);}
 $('resultsView').append(section);
}
function renderQuestion(){
 answered=false;hideSuggestions();const t=round[index];$('questionNumber').textContent=String(index+1).padStart(2,'0');$('total').textContent=' / '+round.length;$('score').textContent=score;$('streak').textContent=streak;$('progressBar').style.width=(index/round.length*100)+'%';
 $('logo').src=promptImage(t);$('logo').alt='Mystery college football team '+questionNoun();$('logo').classList.toggle('helmet-image',activeMode==='helmet');$('feedback').hidden=true;$('next').hidden=true;$('skip').hidden=false;$('keyboardHint').hidden=activeMode!=='choice';$('choices').hidden=activeMode!=='choice';$('typeForm').hidden=activeMode==='choice';$('typedAnswer').value='';$('typedAnswer').disabled=false;$('typeForm').querySelector('button').disabled=false;
 const nicknameMode=activeMode==='nickname';$('logo').hidden=nicknameMode;$('schoolPrompt').hidden=!nicknameMode;$('schoolName').textContent=t.school;
 $('skip').innerHTML=(nicknameMode?'Skip this school':'Skip this '+questionNoun())+' <span>→</span>';$('questionLabel').textContent=nicknameMode?'QUESTION':questionNoun().toUpperCase();$('stageCaption').textContent=nicknameMode?'THE SCHOOL. THE NAME. THE TRADITION.':activeMode==='helmet'?'THE HELMET. THE COLORS. THE TEAM.':'THE MARK. THE TRADITION. THE TEAM.';
 $('quizPrompt').textContent=nicknameMode?'What’s their nickname?':'Whose '+questionNoun()+' is this?';$('typedLabel').textContent=nicknameMode?'Team nickname':'Team name';$('typedAnswer').placeholder=nicknameMode?'Enter the nickname…':'Enter the school name…';
 $('heroTitle').innerHTML=nicknameMode?'Know the school.<br> Name the <em>nickname.</em>':'Know the '+questionNoun()+'.<br> Name the <em>team.</em>';
 $('answerHelp').textContent=nicknameMode?'Type the team’s nickname, then press Check.':activeMode==='choice'?'Pick the team that owns this mark.':'Type the school name. Select a suggestion to guess, or type a name and press Check.';
 options=questionOptions(t,index,roundSeed,teams);$('choices').replaceChildren();
 options.forEach((x,i)=>{const b=document.createElement('button');b.className='answer';b.innerHTML=`<span class="key">${i+1}</span><span>${x.school}</span>`;b.addEventListener('click',()=>answer(x.id===t.id,x.id));$('choices').append(b);});
 $('next').textContent=index===round.length-1?'See my results →':activeMode==='nickname'?'Next school →':'Next '+questionNoun()+' →';
 if(round[index+1]){const im=new Image();im.src=promptImage(round[index+1]);}
}
function answer(correct,selected=null,skipped=false){
 if(answered)return;answered=true;hideSuggestions();const t=round[index];
 record.attempts++;if(correct){score++;streak++;record.correct++;const known=activeMode==='nickname'?record.nicknames:activeMode==='helmet'?record.helmets:record.seen;if(!known.includes(t.id))known.push(t.id);record.best=Math.max(record.best,streak);}else{streak=0;missed.push(t);}
 save();$('score').textContent=score;$('streak').textContent=streak;$('progressBar').style.width=((index+1)/round.length*100)+'%';$('logo').alt=t.school+' '+t.nickname+' '+questionNoun();
 [...$('choices').children].forEach((b,i)=>{b.disabled=true;if(options[i].id===t.id){b.classList.add('correct');b.querySelector('.key').textContent='✓';}else if(options[i].id===selected){b.classList.add('wrong');b.querySelector('.key').textContent='×';}});
 $('typedAnswer').disabled=true;$('typeForm').querySelector('button').disabled=true;
 $('feedback').className='feedback'+(correct?'':' miss');$('feedback').innerHTML=`<strong>${correct?'That’s right!':skipped?(activeMode==='nickname'?'Nickname revealed.':activeMode==='helmet'?'Helmet revealed.':'Logo revealed.'):'Not this time.'} ${t.school} ${t.nickname}.</strong><small>${t.conference} · ${correct?'One more for the record book.':activeMode==='nickname'?'You can practice this nickname after the round.':'You can practice this '+questionNoun()+' after the round.'}</small>`;
 $('feedback').hidden=false;$('next').hidden=false;$('skip').hidden=true;$('keyboardHint').hidden=true;$('next').focus({preventScroll:true});
}
const aliases={
  "103": [
    "Boston College Eagles",
    "BC"
  ],
  "25": [
    "Cal",
    "UC Berkeley",
    "University of California Berkeley",
    "California Berkeley"
  ],
  "228": [
    "Clemson University"
  ],
  "150": [
    "Duke University"
  ],
  "52": [
    "FSU",
    "Florida State University"
  ],
  "59": [
    "Georgia Institute of Technology",
    "Georgia Tech University",
    "GT"
  ],
  "97": [
    "University of Louisville"
  ],
  "2390": [
    "Miami FL",
    "Miami Florida",
    "University of Miami"
  ],
  "152": [
    "North Carolina State",
    "North Carolina State University",
    "NCSU",
    "NC State University"
  ],
  "153": [
    "UNC",
    "University of North Carolina",
    "University of North Carolina at Chapel Hill"
  ],
  "221": [
    "Pitt",
    "University of Pittsburgh"
  ],
  "2567": [
    "Southern Methodist",
    "Southern Methodist University"
  ],
  "24": [
    "Stanford University"
  ],
  "183": [
    "Syracuse University"
  ],
  "258": [
    "UVA",
    "University of Virginia"
  ],
  "259": [
    "VT",
    "Virginia Polytechnic Institute and State University"
  ],
  "154": [
    "Wake Forest University"
  ],
  "349": [
    "West Point",
    "United States Military Academy",
    "Army West Point"
  ],
  "2429": [
    "UNC Charlotte",
    "University of North Carolina at Charlotte"
  ],
  "151": [
    "ECU",
    "East Carolina University"
  ],
  "2226": [
    "FAU",
    "Florida Atlantic University"
  ],
  "235": [
    "University of Memphis"
  ],
  "2426": [
    "United States Naval Academy",
    "US Naval Academy",
    "Naval Academy"
  ],
  "249": [
    "UNT",
    "University of North Texas"
  ],
  "242": [
    "Rice University"
  ],
  "58": [
    "USF",
    "University of South Florida"
  ],
  "218": [
    "Temple University"
  ],
  "2655": [
    "Tulane University"
  ],
  "202": [
    "University of Tulsa"
  ],
  "5": [
    "Alabama Birmingham",
    "University of Alabama at Birmingham",
    "Alabama at Birmingham"
  ],
  "2636": [
    "Texas San Antonio",
    "University of Texas at San Antonio",
    "Texas at San Antonio"
  ],
  "12": [
    "University of Arizona"
  ],
  "9": [
    "ASU",
    "Arizona State University"
  ],
  "239": [
    "Baylor University"
  ],
  "252": [
    "Brigham Young",
    "Brigham Young University"
  ],
  "2132": [
    "University of Cincinnati"
  ],
  "38": [
    "University of Colorado",
    "University of Colorado Boulder"
  ],
  "248": [
    "University of Houston",
    "UH"
  ],
  "66": [
    "ISU",
    "Iowa State University"
  ],
  "2305": [
    "KU",
    "University of Kansas"
  ],
  "2306": [
    "KSU",
    "Kansas State University",
    "K State"
  ],
  "197": [
    "OSU",
    "Oklahoma State University"
  ],
  "2628": [
    "Texas Christian",
    "Texas Christian University"
  ],
  "2641": [
    "TTU",
    "Texas Tech University"
  ],
  "2116": [
    "Central Florida",
    "University of Central Florida"
  ],
  "254": [
    "University of Utah"
  ],
  "277": [
    "WVU",
    "West Virginia University"
  ],
  "356": [
    "University of Illinois",
    "University of Illinois Urbana Champaign"
  ],
  "84": [
    "IU",
    "Indiana University"
  ],
  "2294": [
    "University of Iowa"
  ],
  "120": [
    "UMD",
    "University of Maryland"
  ],
  "130": [
    "University of Michigan"
  ],
  "127": [
    "MSU",
    "Michigan State University"
  ],
  "135": [
    "University of Minnesota"
  ],
  "158": [
    "University of Nebraska",
    "University of Nebraska Lincoln"
  ],
  "77": [
    "Northwestern University"
  ],
  "194": [
    "OSU",
    "Ohio State University",
    "The Ohio State University"
  ],
  "2483": [
    "University of Oregon"
  ],
  "213": [
    "PSU",
    "Pennsylvania State University",
    "Penn State University"
  ],
  "2509": [
    "Purdue University"
  ],
  "164": [
    "Rutgers University"
  ],
  "26": [
    "California Los Angeles",
    "University of California Los Angeles"
  ],
  "30": [
    "Southern California",
    "University of Southern California"
  ],
  "264": [
    "UW",
    "University of Washington"
  ],
  "275": [
    "UW",
    "University of Wisconsin",
    "University of Wisconsin Madison"
  ],
  "48": [
    "University of Delaware"
  ],
  "2229": [
    "FIU",
    "Florida International University"
  ],
  "55": [
    "JSU",
    "Jax State",
    "Jacksonville State University"
  ],
  "338": [
    "KSU",
    "Kennesaw State University"
  ],
  "2335": [
    "Liberty University"
  ],
  "2393": [
    "MTSU",
    "Middle Tennessee State",
    "Middle Tennessee State University"
  ],
  "2623": [
    "MSU",
    "Missouri State University"
  ],
  "166": [
    "NMSU",
    "New Mexico State University"
  ],
  "2534": [
    "SHSU",
    "Sam Houston State",
    "Sam Houston State University"
  ],
  "98": [
    "WKU",
    "Western Kentucky University"
  ],
  "87": [
    "University of Notre Dame"
  ],
  "41": [
    "Connecticut",
    "University of Connecticut"
  ],
  "2006": [
    "University of Akron"
  ],
  "2050": [
    "Ball State University"
  ],
  "189": [
    "BGSU",
    "Bowling Green State",
    "Bowling Green State University"
  ],
  "2084": [
    "University at Buffalo",
    "SUNY Buffalo"
  ],
  "2117": [
    "CMU",
    "Central Michigan University"
  ],
  "2199": [
    "EMU",
    "Eastern Michigan University"
  ],
  "2309": [
    "Kent State University"
  ],
  "113": [
    "UMass",
    "University of Massachusetts",
    "UMass Amherst",
    "University of Massachusetts Amherst"
  ],
  "193": [
    "Miami Ohio",
    "Miami OH",
    "Miami University",
    "Miami University Ohio"
  ],
  "195": [
    "Ohio University"
  ],
  "16": [
    "Sac State",
    "CSUS",
    "Sacramento State University",
    "California State University Sacramento"
  ],
  "2649": [
    "University of Toledo"
  ],
  "2711": [
    "WMU",
    "Western Michigan University"
  ],
  "2005": [
    "US Air Force Academy",
    "United States Air Force Academy",
    "Air Force Academy",
    "USAFA"
  ],
  "62": [
    "Hawaii",
    "University of Hawaii",
    "University of Hawaii at Manoa"
  ],
  "2440": [
    "UNR",
    "University of Nevada",
    "University of Nevada Reno"
  ],
  "167": [
    "UNM",
    "University of New Mexico"
  ],
  "2449": [
    "NDSU",
    "North Dakota State University"
  ],
  "2459": [
    "NIU",
    "Northern Illinois University"
  ],
  "23": [
    "SJSU",
    "San Jose State",
    "San Jose State University"
  ],
  "2439": [
    "Nevada Las Vegas",
    "University of Nevada Las Vegas",
    "University of Nevada at Las Vegas"
  ],
  "2638": [
    "Texas El Paso",
    "University of Texas at El Paso",
    "Texas at El Paso"
  ],
  "2751": [
    "University of Wyoming"
  ],
  "68": [
    "BSU",
    "Boise State University"
  ],
  "36": [
    "CSU",
    "Colorado State University"
  ],
  "278": [
    "California State University Fresno",
    "Fresno State University"
  ],
  "204": [
    "OSU",
    "Oregon State University"
  ],
  "21": [
    "SDSU",
    "San Diego State University"
  ],
  "326": [
    "TXST",
    "Texas State University"
  ],
  "328": [
    "USU",
    "Utah State University"
  ],
  "265": [
    "WSU",
    "Washington State University"
  ],
  "333": [
    "Bama",
    "University of Alabama"
  ],
  "8": [
    "University of Arkansas"
  ],
  "2": [
    "Auburn University"
  ],
  "57": [
    "UF",
    "University of Florida"
  ],
  "61": [
    "UGA",
    "University of Georgia"
  ],
  "96": [
    "UK",
    "University of Kentucky"
  ],
  "99": [
    "Louisiana State",
    "Louisiana State University"
  ],
  "344": [
    "MSU",
    "Mississippi State University"
  ],
  "142": [
    "Mizzou",
    "University of Missouri"
  ],
  "201": [
    "OU",
    "University of Oklahoma"
  ],
  "145": [
    "Mississippi",
    "University of Mississippi"
  ],
  "2579": [
    "South Carolina University",
    "University of South Carolina"
  ],
  "2633": [
    "University of Tennessee",
    "University of Tennessee Knoxville"
  ],
  "251": [
    "UT Austin",
    "University of Texas",
    "University of Texas at Austin"
  ],
  "245": [
    "Texas AM",
    "Texas A and M",
    "Texas A&M University",
    "Texas A and M University"
  ],
  "238": [
    "Vanderbilt University"
  ],
  "2026": [
    "Appalachian State",
    "Appalachian State University"
  ],
  "2032": [
    "Arkansas State University",
    "A State"
  ],
  "324": [
    "CCU",
    "Coastal Carolina University"
  ],
  "290": [
    "Georgia Southern University"
  ],
  "2247": [
    "GSU",
    "Georgia State University"
  ],
  "256": [
    "JMU",
    "James Madison University"
  ],
  "309": [
    "ULL",
    "UL Lafayette",
    "Louisiana Lafayette",
    "University of Louisiana at Lafayette"
  ],
  "2348": [
    "LA Tech",
    "Louisiana Tech University"
  ],
  "276": [
    "Marshall University"
  ],
  "295": [
    "ODU",
    "Old Dominion University"
  ],
  "6": [
    "USA",
    "University of South Alabama"
  ],
  "2572": [
    "USM",
    "Southern Mississippi",
    "University of Southern Mississippi"
  ],
  "2653": [
    "Troy University"
  ],
  "2433": [
    "ULM",
    "Louisiana Monroe",
    "University of Louisiana at Monroe"
  ]
};
function teamNames(t){return [t.school,t.school+' '+t.nickname,...(aliases[t.id]||[])];}
const nicknameAliases={
 '99':['Bayou Bengals'], '87':['Irish'], '356':['Illini'], '333':['Tide'],
 '309':['Cajuns','Ragin Cajuns'], '62':['Warriors'], '48':['Fightin Blue Hens'],
 '2426':['Middies'], '57':['Gators'], '30':['Trojans']
};
function nicknameMatches(value,t){const v=normalize(value);return [t.nickname,t.school+' '+t.nickname,...(nicknameAliases[t.id]||[])].some(name=>normalize(name)===v);}
function typedMatches(value,t){if(activeMode==='nickname')return nicknameMatches(value,t);const v=normalize(value);return teamNames(t).some(name=>normalize(name)===v);}
function hideSuggestions(){
 $('teamSuggestions').hidden=true;$('suggestionList').replaceChildren();$('typedAnswer').setAttribute('aria-expanded','false');$('suggestionStatus').textContent='';
}
function matchingTeams(value){
 const query=normalize(value);if(!query)return [];
 const fiveLetters=query.replace(/[^a-z]/g,'').length>=5;
 return teams.filter(t=>teamNames(t).some(name=>fiveLetters?normalize(name).includes(query):normalize(name)===query)).sort((a,b)=>Number(typedMatches(query,b))-Number(typedMatches(query,a))||Number(normalize(b.school).startsWith(query))-Number(normalize(a.school).startsWith(query))||a.school.localeCompare(b.school));
}
function updateSuggestions(){
 hideSuggestions();if(answered||!['type','helmet'].includes(activeMode))return;
 const matches=matchingTeams($('typedAnswer').value);
 if(!matches.length){$('suggestionStatus').textContent='No matching teams.';return;}
 matches.forEach(t=>{
  const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='team-suggestion';
  const name=document.createElement('strong'),detail=document.createElement('small');name.textContent=t.school;detail.textContent=t.nickname+' · '+t.conference;button.append(name,detail);
  button.addEventListener('click',()=>{$('typedAnswer').value=t.school;answer(t.id===round[index].id,t.id);});
  button.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();hideSuggestions();$('typedAnswer').focus({preventScroll:true});}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const adjacent=event.key==='ArrowDown'?item.nextElementSibling:item.previousElementSibling;if(adjacent)adjacent.firstElementChild.focus();else if(event.key==='ArrowUp')$('typedAnswer').focus({preventScroll:true});}});
  item.append(button);$('suggestionList').append(item);
 });
 $('teamSuggestions').hidden=false;$('typedAnswer').setAttribute('aria-expanded','true');$('suggestionStatus').textContent=matches.length+' matching team'+(matches.length===1?'':'s')+'. Use Tab or the down arrow to select a match.';
}
function next(){if(!answered)return;index++;if(index===round.length)finish();else{renderQuestion();if(activeMode!=='choice')$('typedAnswer').focus({preventScroll:true});else $('choices').firstChild.focus({preventScroll:true});}}
function finish(){
 $('questionView').hidden=true;$('resultsView').hidden=false;const pct=Math.round(score/round.length*100),noun=questionNoun();
 const summary=missed.length?missed.length+' '+noun+(missed.length===1?'':'s')+' to get to know a little better.':activeMode==='nickname'?'You knew every nickname. Ready for another field?':'You identified every '+noun+'. Ready for another field?';
 const missedList=missed.length?`<div class="missed-list">${missed.map(t=>`<div class="missed-item"><img src="${promptImage(t)}" alt=""><span>${t.school} ${t.nickname}<small>${t.conference}</small></span></div>`).join('')}</div><button class="primary" id="retry">Practice missed ${noun}s →</button>`:'';
 $('resultsView').innerHTML=`<div class="eyebrow">${isPractice?'PRACTICE COMPLETE':'FINAL WHISTLE'}</div><div class="result-score">${score}<span> / ${round.length}</span></div><h2>${pct===100?'A perfect game.':pct>=80?'You know ball.':pct>=50?'A solid starting lineup.':'Every fan starts somewhere.'}</h2><p>${pct}% accuracy this round.<br>${summary}</p>${missedList}<button class="primary" id="again">Play another round →</button>`;
 if(roundChallenge)addChallengeResult();
 $('again').addEventListener('click',()=>startRound());if(missed.length)$('retry').addEventListener('click',()=>startRound([...missed]));$('resultsView').querySelector('button').focus({preventScroll:true});
}
function showView(view){$('playView').hidden=view!=='play';$('libraryView').hidden=view!=='library';$('playTab').classList.toggle('active',view==='play');$('libraryTab').classList.toggle('active',view==='library');if(view==='library')renderLibrary();}
function renderLibrary(){
 const q=normalize($('search').value),conf=$('libraryConference').value;const filtered=teams.filter(t=>(conf==='All'||t.conference===conf)&&teamNames(t).some(name=>normalize(name).includes(q))).sort((a,b)=>a.school.localeCompare(b.school));
 $('libraryCount').textContent=filtered.length+' / 138 teams';$('noTeams').hidden=filtered.length!==0;
 $('teamGrid').innerHTML=filtered.map(t=>`<article class="team-card"><img src="${t.logo}" alt="${t.school} logo" loading="lazy" width="80" height="80"><h3>${t.school}</h3><p>${t.nickname}</p><p>${t.conference}</p>${record.seen.includes(t.id)?'<div class="identified">✓ Identified</div>':''}</article>`).join('');
}
$('start').addEventListener('click',()=>{startRound(null,pendingChallenge);if(matchMedia('(max-width:760px)').matches)document.querySelector('.quiz').scrollIntoView({behavior:'smooth',block:'start'});});
$('soloMode').addEventListener('change',updatePlayStyle);$('challengeMode').addEventListener('change',updatePlayStyle);
$('next').addEventListener('click',next);$('skip').addEventListener('click',()=>answer(false,null,true));
$('typeForm').addEventListener('submit',e=>{e.preventDefault();if(!$('typedAnswer').value.trim()){$('typedAnswer').focus();return;}answer(typedMatches($('typedAnswer').value,round[index]));});
$('typedAnswer').addEventListener('input',updateSuggestions);
$('typedAnswer').addEventListener('keydown',event=>{if(event.key==='Escape')hideSuggestions();if(event.key==='ArrowDown'&&!$('teamSuggestions').hidden){event.preventDefault();$('suggestionList').firstElementChild.firstElementChild.focus();}});
$('playTab').addEventListener('click',()=>showView('play'));$('libraryTab').addEventListener('click',()=>showView('library'));$('backToQuiz').addEventListener('click',()=>showView('play'));
$('search').addEventListener('input',renderLibrary);$('libraryConference').addEventListener('change',renderLibrary);
$('about').addEventListener('click',()=>$('aboutDialog').showModal());$('closeAbout').addEventListener('click',()=>$('aboutDialog').close());
document.addEventListener('keydown',e=>{if(e.repeat||$('playView').hidden||$('questionView').hidden||$('aboutDialog').open||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(activeMode==='choice'&&!answered&&/^[1-4]$/.test(e.key)){e.preventDefault();$('choices').children[Number(e.key)-1].click();}if(e.key==='Enter'&&answered&&document.activeElement.tagName!=='BUTTON'){e.preventDefault();next();}});
fetch('teams.json?v=helmets-1').then(r=>{if(!r.ok)throw Error('data');return r.json();}).then(data=>{teams=data;const conferences=[...new Set(teams.map(t=>t.conference))].sort();for(const conf of conferences){const count=teams.filter(t=>t.conference===conf).length;for(const id of ['conference','libraryConference']){const o=document.createElement('option');o.value=conf;o.textContent=conf+' · '+count+' teams';$(id).append(o);}}updateStats();if(!handleChallengeURL())startRound();}).catch(()=>$('loadingError').hidden=false);

window.addEventListener('hashchange',()=>{if(teams.length)handleChallengeURL();});
