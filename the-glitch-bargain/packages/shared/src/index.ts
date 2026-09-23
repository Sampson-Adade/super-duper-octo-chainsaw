export type Phase = 'LOBBY'|'HACKING'|'COUNTER_CODING'|'REVIEW'|'CHALLENGE'|'ADJUDICATING'|'RESOLUTION'|'FUSION_SELECT'|'CAMPAIGN_BREAK'|'ALLY_SELECT'|'GAME_OVER';
export type Personality = 'glitch'|'corporate'|'villain';
export type GameMode = 'solo'|'multiplayer'|'raid';
export type Difficulty = 'easy'|'medium'|'hard';
export type Player = { id:string; name:string; score:number; alive:boolean; connected:boolean; host:boolean; queuedForNextRound:boolean; thermalHeat:number };
export type AIAlly = { id:string; name:string; rank:number; components:string[]; obedienceTier:0|1|2|3; consecutiveWins:number; rebootPending:boolean };
export type RaidAssignment = { playerId:string; lines:string[] };
export type TerminalEvent = { id:string; sequence:number; tone:'amber'|'cyan'; message:string };
export type PublicRoom = { code:string; phase:Phase; mode:GameMode; difficulty:Difficulty; players:Player[]; round:number; rounds:number; campaignStage:number; personality:Personality; deadline:number|null; phaseDurationSeconds:number; threat:string; threatType:string; syntaxLevel:number; aiName:string|null; lives:number; maxLives:number; capturedAis:string[]; allies:AIAlly[]; selectedAllyId:string|null; pendingMergeAiId:string|null; requiredCodeLines:number; requiredCode:string[]; allyCodeLineCount:number; raidParticipantCount:number; raidErasureIntervalMs:number; raidAssignments:RaidAssignment[]; terminalEvents:TerminalEvent[]; assistUsed:boolean; counterCode:string|null; soloOutcome:'success'|'failure'|null; submittedPlayerIds:string[]; submissions:{playerId:string;source:string;valid:boolean;errors:string[];claims:{type:string;item:string;verified:boolean|null}[]}[]; challenges:{challengerId:string;targetPlayerId:string;claimIndex:number;reason:string;result?:string}[]; narration?:string };

const PROFANE_USERNAME_TERMS = [
  'fuck', 'shit', 'bitch', 'ass', 'asshole', 'bastard', 'damn', 'hell', 'crap', 'dick', 'piss', 'pussy', 'cock', 'cunt', 'twat', 'wanker', 'motherfucker', 'fucker', 'fag', 'faggot', 'slut', 'whore', 'arse', 'prick', 'douche', 'bollock', 'nigger', 'nigga',
  'wtf', 'stfu', 'gtfo', 'smd', 'fml', 'omfg', 'lmfao', 'fucc', 'fuk', 'fck', 'fkn', 'phuk', 'shyt', 'sht', 'azz', 'b!tch', 'btch', 'd!ck', 'biatch', 'badass', 'jackass', 'dumbass', 'fatass', 'asshat', 'asswipe', 'assclown', 'smartass',
];

const ADULT_USERNAME_TERMS = [
  'sex', 'sexy', 'sexual', 'sext', 'sexting', 'sextoy', 'sexchat', 'sexcam', 'sexbot', 'sexslave', 'sexwork', 'sexx', 'secks', 'seggs', 'xxx', 'nsfw', 'dtf', 'fwb', 'bj', 'hj', 'thot', 'puh', 'dih', 'bussy', 'grussy', 'thussy', 'mussy',
  'porn', 'porno', 'pornography', 'pornographic', 'pornstar', 'pornhub', 'xvideos', 'xhamster', 'xnxx', 'youporn', 'redtube', 'cornhub', 'onlyfans', 'fansly', 'rule34', 'r34', 'hentai', 'ecchi', 'ahegao', 'lolicon', 'shota', 'futa', 'futanari',
  'nude', 'nudes', 'nudity', 'naked', 'erotic', 'erotica', 'lewd', 'smut', 'fetish', 'bdsm', 'kinky', 'horny', 'orgasm', 'orgasmic', 'milf', 'dilf', 'gilf',
  'masturbate', 'masturbating', 'masturbation', 'wanking', 'jerkoff', 'fap', 'fapping', 'gooning', 'blowjob', 'handjob', 'footjob', 'rimjob', 'titjob', 'boobjob', 'gangbang', 'threesome', 'orgy', 'deepthroat', 'creampie', 'fisting',
  'cum', 'cumming', 'cumshot', 'jizz', 'semen', 'ejaculate', 'ejaculation', 'penis', 'vagina', 'vulva', 'clit', 'clitoris', 'genitals',
  'boobs', 'tits', 'nipples', 'boner', 'hardon', 'erection', 'dildo', 'vibrator', 'buttplug', 'anal', 'analsex',
  'rape', 'rapist', 'raping', 'incest', 'incestuous', 'pedo', 'pedophile', 'paedophile', 'childporn', 'bestiality', 'zoophilia', 'necrophilia',
  'stripper', 'prostitute', 'hooker', 'brothel', 'sugardaddy', 'sugarbaby', 'jailbait', '69',
];

const CONFUSABLE_CHARACTERS: Record<string, string> = {
  'а': 'a', 'ӓ': 'a', 'ɑ': 'a', 'α': 'a', 'в': 'b', 'ь': 'b', 'β': 'b', 'с': 'c', 'ϲ': 'c', 'ԁ': 'd',
  'е': 'e', 'ё': 'e', 'ε': 'e', 'ҽ': 'e', 'ғ': 'f', 'ɡ': 'g', 'һ': 'h', 'н': 'h', 'і': 'i', 'ї': 'i', 'ι': 'i',
  'ј': 'j', 'κ': 'k', 'к': 'k', 'ӏ': 'l', 'м': 'm', 'ո': 'n', 'п': 'n', 'о': 'o', 'ο': 'o', 'р': 'p', 'ρ': 'p',
  'զ': 'q', 'г': 'r', 'ѕ': 's', 'տ': 's', 'т': 't', 'τ': 't', 'υ': 'u', 'ν': 'v', 'х': 'x', 'χ': 'x', 'у': 'y', 'ү': 'y', 'ᴢ': 'z',
};

function normalizeProfanityText(value: unknown) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[аӓɑαвьβсϲԁеёεҽғɡһніїιјκкӏмոпооοрρզгѕտтτυνхχууүᴢ]/g, (character) => CONFUSABLE_CHARACTERS[character] ?? character)
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/[@4]/g, 'a').replace(/[!1|]/g, 'i').replace(/3/g, 'e').replace(/[5$]/g, 's')
    .replace(/7/g, 't').replace(/8/g, 'b').replace(/0/g, 'o').replace(/2/g, 'z');
}

export function containsProfanity(value: unknown) {
  const normalized = normalizeProfanityText(value);
  const words: string[] = normalized.match(/[a-z0-9]+/g) ?? [];
  const compact = words.join('');
  const matchesTerm = (term: string) => {
    const safeTerm = normalizeProfanityText(term).replace(/[^a-z0-9]/g, '');
    if (!safeTerm) return false;
    if (words.includes(safeTerm) || compact === safeTerm) return true;
    // Check each component so a bad word stays blocked inside multiword names,
    // while short roots such as "ass" do not flag unrelated words like "class".
    return safeTerm.length >= 4 && words.some((word) => word.startsWith(safeTerm) || (word.endsWith(safeTerm) && !(safeTerm === 'hell' && word.endsWith('shell'))));
  };
  const blockedTerms = [...PROFANE_USERNAME_TERMS, ...ADULT_USERNAME_TERMS];
  const sexualSlang = ['puh', 'dih'];
  const hasSlangCompound = words.some((word) => sexualSlang.some((term) => word.startsWith(term) || word.endsWith(term)));
  const hasSexualCompound = words.some((word) => word.startsWith('sex'));
  const fillerSlang = new Set(['uhh', 'uhhh', 'uhhhh', 'uhhhhh', 'uhhhhhh']);
  const sexualContext = new Set(['wet', 'juicy', 'dripping', 'soggy', 'sloppy', 'tight']);
  const hasSexualPhrase = words.some((word, index) => fillerSlang.has(word)
    && [...words.slice(Math.max(0, index - 3), index), ...words.slice(index + 1, index + 4)].some((neighbor) => sexualContext.has(neighbor)));
  const compactSexualPhrase = ['wetuhh', 'wetuhhh', 'wetuhhhh', 'juicyuhh', 'juicyuhhh', 'drippinguhh', 'soggyuhh', 'uhhwet', 'uhhhwet'].some((phrase) => compact.includes(phrase));
  return hasSlangCompound || hasSexualCompound || hasSexualPhrase || compactSexualPhrase || blockedTerms.some(matchesTerm);
}

export function validateUsername(value: unknown) {
  const name = String(value ?? '').normalize('NFKC').replace(/[\r\n\u0000-\u001f\u007f"]/g, '').trim().slice(0, 20);
  if (!name) return { ok: false as const, name: '', error: 'Enter a player name first.' };
  if (containsProfanity(name)) return { ok: false as const, name, error: 'Choose a kid-friendly callsign without profanity or sexual and adult terms.' };
  return { ok: true as const, name, error: '' };
}
