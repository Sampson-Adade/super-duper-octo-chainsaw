'use client';

import { useEffect, useState } from 'react';
import type { Difficulty, GameMode } from '@glitch/shared';

type Props = {
  open: boolean;
  onClose: () => void;
  mode?: GameMode;
  difficulty?: Difficulty;
  syntaxLevel?: number;
  campaignStage?: number;
  round?: number;
};

const modes: { id: GameMode; label: string }[] = [
  { id: 'solo', label: 'SOLO CAMPAIGN' },
  { id: 'multiplayer', label: 'MULTIPLAYER' },
  { id: 'raid', label: 'CO-OP RAID' },
];

const difficultyTime: Record<Difficulty, string> = { easy: '90 seconds', medium: '60 seconds', hard: '30 seconds' };

export function HowToPlay({ open, onClose, mode = 'multiplayer', difficulty = 'medium', syntaxLevel = 1, campaignStage = 1, round = 1 }: Props) {
  const [selectedMode, setSelectedMode] = useState<GameMode>(mode);
  const [selectedLevel, setSelectedLevel] = useState(Math.max(1, Math.min(3, mode === 'solo' ? campaignStage : syntaxLevel)));

  useEffect(() => {
    if (!open) return;
    setSelectedMode(mode);
    setSelectedLevel(Math.max(1, Math.min(3, mode === 'solo' ? campaignStage : syntaxLevel)));
  }, [open, mode, syntaxLevel, campaignStage]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  const modeLabel = modes.find((entry) => entry.id === selectedMode)?.label || 'MULTIPLAYER';
  const heading = selectedMode === 'solo' ? 'One operative. One AI at a time.'
    : selectedMode === 'raid' ? 'Work together to breach one boss.'
      : 'A simple code puzzle, then a bluffing game.';

  return (
    <div className="manualOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="manualDialog" role="dialog" aria-modal="true" aria-labelledby="manualTitle" onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()}>
        <header className="manualHeader">
          <div><div className="eyebrow">FIELD MANUAL · {modeLabel}</div><h2 id="manualTitle">How to play</h2></div>
          <button className="manualClose" onClick={onClose} aria-label="Close how to play">CLOSE ×</button>
        </header>

        <div className="manualModes" role="tablist" aria-label="Choose a game mode">
          {modes.map((entry) => <button key={entry.id} role="tab" aria-selected={selectedMode === entry.id} className={selectedMode === entry.id ? 'selected' : ''} onClick={() => { setSelectedMode(entry.id); setSelectedLevel(Math.max(1, Math.min(3, entry.id === 'solo' ? campaignStage : syntaxLevel))); }}>{entry.label}</button>)}
        </div>

        <div className="manualIntro">
          <h3>{heading}</h3>
          <p>Read the round’s threat, follow the matching code guide, and submit before the timer ends. Every line must end with a semicolon (;). The code is a made-up game language; the game checks it as text and never runs it on your device.</p>
        </div>

        <div className="manualMeta"><span>ROOM TIMER: {difficulty.toUpperCase()} · {difficultyTime[difficulty]}</span><span>ROUND {round || 1} · {selectedMode === 'solo' ? `CAMPAIGN TIER ${campaignStage}` : `SYNTAX LEVEL ${syntaxLevel}`}</span></div>

        {selectedMode === 'solo' ? <>
          <div className="manualSteps">
            <article><b>1 · FOLLOW THIS BOSS</b><p>Each round shows a new AI name, threat, and randomized code recipe. Type the recipe exactly as shown; the guide tells you what to target and which lines this boss accepts. Two quick-add buttons start unlocked, with one more each campaign tier.</p></article>
            <article><b>2 · USE YOUR TIME</b><p>Easy gives 90 seconds, Medium 60, and Hard 30. In the last five seconds the boss erases your draft. If time runs out, it counter-codes for five seconds and you lose a life. You start with three.</p></article>
            <article><b>3 · GROW YOUR ROSTER</b><p>Defeated bosses join your roster. Clear a tier, pick an AI for the next tier, and choose whether each new capture stays separate or merges into one you own.</p></article>
          </div>
          <div className="manualRules"><b>AI CO-PILOT RULES · FROM TIER 2</b><p>Choose an ally and prompt it once per boss. It can fill up to half of the full recipe, continuing after your correctly typed lines; you type the rest. A loss lowers its obedience. Tier 0 locks it until you survive a round without help or win a verified bluff, which schedules a reboot for the next round.</p></div>
        </> : selectedMode === 'multiplayer' ? <>
          <div className="manualSteps">
            <article><b>1 · START A ROOM</b><p>The host chooses Multiplayer, sets the timer and rounds, then shares the room link. Start with at least two players. Each player writes their own answer to the same three-line puzzle.</p></article>
            <article><b>2 · TYPE THREE CORE LINES</b><p>Use the threat trigger shown on screen, set a target to another player’s exact callsign, then add the bypass line. Two quick-add buttons start unlocked; another unlocks at each syntax level. Type all other lines yourself.</p></article>
            <article><b>3 · REVIEW AND CHALLENGE</b><p>Submit a valid answer to lock it in. At Level 2, a physical claim can be challenged. The host marks claims true or false, then the game shows the round result and scores.</p></article>
          </div>
          <div className="manualRules"><b>AI RULES & LATE ARRIVALS</b><p>The rogue AI supplies the round threat. The game judge checks code and resolves scores; players decide whether to bluff or challenge. The solo co-pilot is not available in this mode. Friends can join mid-game as spectators and become active automatically next round.</p></div>
        </> : <>
          <div className="manualSteps">
            <article><b>1 · SPLIT THE WORK</b><p>Start with at least two players. The lead operative gets the three opening lines; everyone gets two personal lines on their assignment card.</p></article>
            <article><b>2 · TYPE YOUR ASSIGNMENT</b><p>Type only the lines assigned to you, exactly as shown, including semicolons. Two quick-add buttons start unlocked; more unlock with each syntax level. The boss needs three opening lines plus two lines for each living operative.</p></article>
            <article><b>3 · SUBMIT TOGETHER</b><p>The raid clears when every active operative submits a valid contribution. More players add work and extend the timer. The boss starts erasing drafts near the end.</p></article>
          </div>
          <div className="manualRules"><b>AI RULES & LATE ARRIVALS</b><p>The raid boss sets the threat and attacks the team’s code near the deadline. The game checks each assignment. New players can join as spectators and are added to the crew automatically next round.</p></div>
        </>}

        <div className="manualLevelBar">
          <div><b>{selectedMode === 'solo' ? 'CAMPAIGN TIER GUIDE' : 'SYNTAX LEVEL TUTORIAL'}</b><span>Pick any level to see its rules.</span></div>
          <div className="manualLevelTabs" role="tablist" aria-label={selectedMode === 'solo' ? 'Campaign tier tutorial' : 'Syntax level tutorial'}>
            {[1, 2, 3].map((level) => <button key={level} role="tab" aria-selected={selectedLevel === level} className={selectedLevel === level ? 'selected' : ''} onClick={() => setSelectedLevel(level)}>{selectedMode === 'solo' ? `TIER ${level}` : `LV ${level}`}</button>)}
          </div>
        </div>
        <div className="manualLevelText">
          {selectedLevel === 1 && (selectedMode === 'solo' ? <>
            <p><b>Tier 1 · Learn the boss’s recipe.</b> Every boss has a randomized set of lines and names. Type the exact guide shown for this round; recipes change, so do not reuse code from an earlier boss.</p>
            <div className="manualRules"><b>YOUR GOAL</b><p>Target the named AI, bypass its threat using your callsign, and finish the required actions before time expires. All lines need a semicolon.</p></div>
          </> : <>
            <p><b>Level 1 · Learn the three core lines.</b> Multiplayer starts with a threat, a target, and a bypass. The on-screen guide fills in this round’s exact names and words.</p>
            <div className="manualCodeList"><code>when AI.threatens(&quot;THREAT SHOWN&quot;);</code><code>define target as &quot;NAME SHOWN&quot;;</code><code>trigger bypass on player;</code></div>
            <p>{selectedMode === 'raid' ? 'The lead operative types the opening lines; use the personal assignment for your remaining lines.' : 'Choose a player other than yourself as the target. You can add two core lines with buttons; type the rest.'}</p>
          </>)}
          {selectedLevel === 2 && (selectedMode === 'solo' ? <>
            <p><b>Level 2 · Your first AI ally.</b> Clear your opening tier, choose one captured AI, and select the ally you want to bring forward. Boss recipes add randomized required actions, so use this round’s guide.</p>
            <div className="manualRules"><b>THE 50% LIMIT</b><p>Prompt your ally once per boss. It starts after your correctly typed progress and fills no more than half of the full recipe; you complete the rest. Keep an eye on its obedience tier.</p></div>
          </> : selectedMode === 'multiplayer' ? <>
            <p><b>Level 2 · Add a condition or a physical claim.</b> Multiplayer reaches Level 2 on round 3. A physical claim can be checked by the host and challenged by another player.</p>
            <div className="manualCodeList"><code>require player.holding(&quot;metal&quot;);</code><code>unless target.is(&quot;hat&quot;);</code></div>
            <p>Claims make the round more interesting, but a false claim can cost you. Your code still needs its three core lines.</p>
          </> : <>
            <p><b>Level 2 · The squad grows.</b> Raid assignments stay simple: the lead has three opening lines, and each operative has two personal lines. More living players increase total work and extend the timer.</p>
            <p>Use the assignment card as your source of truth. Do not type another operative’s lines.</p>
          </>)}
          {selectedLevel === 3 && (selectedMode === 'solo' ? <>
            <p><b>Level 3 · The bosses adapt.</b> Solo recipes keep adding randomized required actions as your campaign grows, and code erasure speeds up. Use every line on the current boss’s guide.</p>
            <div className="manualRules"><b>ALLY TRUST</b><p>A loss lowers obedience by one tier. Tier 0 locks summoning. Win without help or earn a verified bluff to schedule the ally’s reboot for the next round.</p></div>
          </> : selectedMode === 'multiplayer' ? <>
            <p><b>Level 3 · Redirect or override.</b> Multiplayer reaches Level 3 on round 5. These advanced optional lines can change who the threat targets or how a purge is stopped.</p>
            <div className="manualCodeList"><code>redirect target to &quot;CALLSIGN&quot;;</code><code>override system.purge();</code></div>
            <p>Your three core lines are still required; use the extra rules only when you want to add them.</p>
          </> : <>
            <p><b>Level 3 · A faster raid.</b> The raid boss scales with the round and crew size. Each operative still follows their own assignment; more operatives mean more total lines and faster code erasure.</p>
            <p>Split the work, use Quick Add for your first lines, and call out if someone needs help before the deadline.</p>
          </>)}
        </div>

        <footer className="manualFooter"><span>QUICK TIP: read the requirement card, type the shown lines, check every semicolon, then submit.</span><button className="primary" onClick={onClose}>GOT IT</button></footer>
      </section>
    </div>
  );
}
