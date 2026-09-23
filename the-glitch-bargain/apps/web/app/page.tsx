'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { validateUsername } from '@glitch/shared';
import type { Difficulty, PublicRoom } from '@glitch/shared';
import { QRCodeSVG } from 'qrcode.react';

const difficultyOptions: { id: Difficulty; label: string; seconds: number }[] = [
  { id: 'easy', label: 'EASY', seconds: 90 },
  { id: 'medium', label: 'MEDIUM', seconds: 60 },
  { id: 'hard', label: 'HARD', seconds: 30 },
];

function token() {
  const make = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  try {
    let value = localStorage.getItem('glitch-player-token');
    if (!value) {
      value = make();
      try { localStorage.setItem('glitch-player-token', value); } catch { /* storage may be disabled */ }
    }
    return value;
  } catch { return make(); }
}

type HomeProps = { initialRoomCode?: string; lockRoomCode?: boolean };

export default function Home({ initialRoomCode = '', lockRoomCode = false }: HomeProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialRoomCode);
  const [source, setSource] = useState('');
  const [allyPrompt, setAllyPrompt] = useState('');
  const [allyReply, setAllyReply] = useState('');
  const [err, setErr] = useState('');
  const [serverConnected, setServerConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [personality, setPersonality] = useState('glitch');
  const [rounds, setRounds] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [copied, setCopied] = useState(false);
  const [mergeTargetAllyId, setMergeTargetAllyId] = useState('');
  const [origin, setOrigin] = useState('');
  const [thermalNotice, setThermalNotice] = useState('');
  const thermalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thermalNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeEditorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { if (initialRoomCode) setCode(initialRoomCode.toUpperCase()); }, [initialRoomCode]);
  useEffect(() => () => {
    if (thermalTimer.current) clearTimeout(thermalTimer.current);
    if (thermalNoticeTimer.current) clearTimeout(thermalNoticeTimer.current);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim() || window.location.origin;
    const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH?.trim() || '/socket.io';
    const connection = io(socketUrl, {
      path: socketPath, autoConnect: false, timeout: 5000, transports: ['websocket'],
    });
    setSocket(connection);
    connection.on('connect', () => { setServerConnected(true); setErr(''); });
    connection.on('disconnect', () => setServerConnected(false));
    connection.on('connect_error', (error) => {
      console.error('Game server connection failed:', error.message);
      setServerConnected(false);
      setErr('Cannot reach the game server. Refresh the page and try again.');
    });
    connection.on('room:state', (nextRoom: PublicRoom) => {
      setRoom(nextRoom);
      setPersonality(nextRoom.personality);
      setRounds(nextRoom.rounds);
      setDifficulty(nextRoom.difficulty);
    });
    connection.connect();
    return () => { connection.disconnect(); };
  }, []);

  useEffect(() => {
    if (!room?.deadline) { setSeconds(0); return; }
    const tick = () => setSeconds(Math.max(0, Math.ceil((room.deadline! - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [room?.deadline]);

  useEffect(() => {
    if (room?.phase === 'HACKING') { setSource(''); setAllyReply(''); setAllyPrompt(''); }
  }, [room?.round, room?.campaignStage, room?.phase]);

  useEffect(() => { setMergeTargetAllyId(''); }, [room?.phase, room?.pendingMergeAiId]);

  const selectedAllyRank = room?.allies.find((ally) => ally.id === room.selectedAllyId)?.rank ?? 0;
  const erasureInterval = room?.mode === 'raid'
    ? room.raidErasureIntervalMs
    : Math.max(80, 520 - ((room?.campaignStage ?? 1) - 1) * 100 + Math.min(60, Math.max(0, selectedAllyRank - 1) * 15));
  const erasureActive = room?.phase === 'HACKING' && seconds > 0 && (room.mode === 'solo' ? seconds <= 5 : room.mode === 'raid' && seconds <= 10);
  useEffect(() => {
    if (!erasureActive) return;
    const timer = setInterval(() => setSource((current) => current.length ? current.slice(1) : current), erasureInterval);
    return () => clearInterval(timer);
  }, [erasureActive, erasureInterval]);

  const me = room?.players.find((player) => player.id === playerId);
  const submitted = !!room?.submittedPlayerIds.includes(playerId);
  const phaseTime = room?.phaseDurationSeconds || (room?.phase === 'HACKING' ? (room.difficulty === 'easy' ? 90 : room.difficulty === 'hard' ? 30 : 60)
    : room?.phase === 'COUNTER_CODING' ? 5
      : room?.phase === 'CHALLENGE' ? 20
        : room?.phase === 'REVIEW' ? 4
          : room?.phase === 'ADJUDICATING' ? 10
            : room?.phase === 'RESOLUTION' ? 6 : 1);
  const progress = room?.deadline ? Math.max(0, Math.min(100, seconds / phaseTime * 100)) : 0;

  function create() {
    const username = validateUsername(name);
    if (!username.ok) return setErr(username.error);
    setName(username.name);
    const currentSocket = socket;
    if (!currentSocket) return setErr('Connecting to the game server…');
    const send = () => {
      setErr('Creating room…');
      currentSocket.timeout(8000).emit('room:create', { name: username.name, token: token() }, (timeoutError: any, result: any) => {
        if (timeoutError) return setErr('The game server did not respond. Refresh the page and try again.');
        if (result?.ok) { setPlayerId(result.playerId); setErr(''); }
        else setErr(result?.error || 'Could not create the room. Try again.');
      });
    };
    if (currentSocket.connected) return send();
    setErr('Connecting to the game server…');
    currentSocket.once('connect', send);
    currentSocket.connect();
  }

  function join() {
    const username = validateUsername(name);
    if (!username.ok) return setErr(username.error);
    if (!code.trim()) return setErr('Add your room code.');
    setName(username.name);
    if (!socket?.connected) return setErr('Connecting to the game server. Please try again in a moment.');
    socket.timeout(8000).emit('room:join', { name: username.name, code, token: token() }, (timeoutError: any, result: any) => {
      if (timeoutError) return setErr('The game server did not respond. Refresh the page and try again.');
      if (result?.ok) { setPlayerId(result.playerId); setErr(''); }
      else setErr(result?.error || 'Could not join the room.');
    });
  }

  function submit() {
    socket?.emit('hack:submit', { source }, (result: any) => {
      if (!result?.ok) setErr(result?.error || 'Submission rejected.');
      else setErr('');
    });
  }

  function requestAllyAssist() {
    socket?.emit('solo:assist', { source, prompt: allyPrompt }, (result: any) => {
      if (!result?.ok) return setErr(result?.error || 'AI ally support is unavailable.');
      setSource(result.draft);
      setAllyReply(`${result.reply} ${result.lines}/${result.totalLines} total lines are now in your draft; finish the rest yourself.`);
      setErr('');
      codeEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      codeEditorRef.current?.focus();
    });
  }

  async function copyInviteLink() {
    if (!room || !origin) return;
    const inviteUrl = `${origin}/join?room=${encodeURIComponent(room.code)}`;
    try {
      let copiedToClipboard = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(inviteUrl);
          copiedToClipboard = true;
        }
      } catch { /* use the selection fallback on browsers without clipboard permission */ }
      if (!copiedToClipboard) {
        const temporary = document.createElement('textarea');
        temporary.value = inviteUrl;
        temporary.style.position = 'fixed';
        temporary.style.opacity = '0';
        document.body.appendChild(temporary);
        temporary.select();
        const copiedToClipboard = document.execCommand('copy');
        temporary.remove();
        if (!copiedToClipboard) throw new Error('Clipboard unavailable');
      }
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr('Could not copy the invite link. Copy it from your browser address bar instead.');
    }
  }

  function queueThermalRoll() {
    if (thermalTimer.current) clearTimeout(thermalTimer.current);
    thermalTimer.current = setTimeout(() => {
      socket?.timeout(2500).emit('thermal:manual', {}, (timeoutError: any, result: any) => {
        if (timeoutError || !result?.ok || result.skipped) return;
        setThermalNotice(result.outcome);
        if (thermalNoticeTimer.current) clearTimeout(thermalNoticeTimer.current);
        thermalNoticeTimer.current = setTimeout(() => setThermalNotice(''), 2200);
      });
    }, 700);
  }

  function selectAlly(allyId: string) {
    socket?.emit('ally:select', { allyId }, (result: any) => {
      if (!result?.ok) setErr(result?.error || 'Could not select that AI.');
      else setErr('');
    });
  }

  function continueCampaign() {
    socket?.emit('campaign:continue', {}, (result: any) => {
      if (!result?.ok) setErr(result?.error || 'Select an ally to continue.');
      else { setSource(''); setErr(''); }
    });
  }

  function resolveFusion(targetAllyId: string | null) {
    socket?.emit('fusion:resolve', { targetAllyId }, (result: any) => {
      if (!result?.ok) setErr(result?.error || 'Could not finish the fusion choice.');
      else { setMergeTargetAllyId(''); setErr(''); }
    });
  }

  function goHome() {
    if (!window.confirm('Leave this game and return to the start screen?')) return;
    socket?.emit('room:quit', {}, (result: any) => {
      if (!result?.ok) return setErr(result?.error || 'Could not leave the room.');
      setRoom(null);
      setPlayerId('');
      setSource('');
      setAllyReply('');
      setAllyPrompt('');
      setErr('');
    });
  }

  function goBack() {
    socket?.emit('room:quit', {}, (result: any) => {
      if (!result?.ok) return setErr(result?.error || 'Could not leave the room.');
      setRoom(null);
      setPlayerId('');
      setSource('');
      setAllyReply('');
      setAllyPrompt('');
      setErr('');
      if (window.history.length > 1) window.history.back();
    });
  }

  function restartGame() {
    if (!window.confirm('Restart the game with the same players and settings?')) return;
    socket?.emit('game:restart', {}, (result: any) => {
      if (!result?.ok) return setErr(result?.error || 'Could not restart the game.');
      setSource('');
      setAllyReply('');
      setAllyPrompt('');
      setErr('');
    });
  }

  function challenge(targetPlayerId: string, claimIndex: number) {
    socket?.emit('challenge:submit', { targetPlayerId, claimIndex }, (result: any) => {
      if (!result?.ok) setErr(result.error);
      else setErr('Challenge filed.');
    });
  }

  function verifyClaim(targetPlayerId: string, claimIndex: number, verified: boolean) {
    socket?.emit('claim:verify', { playerId: targetPlayerId, claimIndex, verified }, (result: any) => {
      if (!result?.ok) setErr(result.error);
      else setErr('Claim status updated.');
    });
  }

  const triggerChip = `when AI.threatens("${room?.threatType || 'purge'}");`;
  const opponentName = room?.mode === 'solo'
    ? room.aiName || 'AI'
    : room?.mode === 'raid'
      ? room.aiName || 'RAID BOSS'
    : room?.players.find((player) => player.id !== playerId)?.name || room?.players[0]?.name || 'Player';
  const bypassChip = room?.mode === 'solo'
    ? `trigger bypass on "${me?.name || 'Player'}";`
    : 'trigger bypass on player;';
  const chips = useMemo(() => [
    triggerChip,
    `define target as "${opponentName}";`,
    bypassChip,
    ...(room?.mode === 'solo' ? [`initiate lockdown on "${opponentName}";`] : []),
    ...(room?.mode !== 'solo' && room?.syntaxLevel && room.syntaxLevel >= 2 ? ['require player.holding("metal");', 'unless target.is("hat");'] : []),
    ...(room?.mode !== 'solo' && room?.syntaxLevel && room.syntaxLevel >= 3 ? [`redirect target to "${opponentName}";`, 'override system.purge();'] : []),
  ], [triggerChip, opponentName, bypassChip, room?.mode, room?.syntaxLevel]);
  const raidAssignment = room?.raidAssignments.find((assignment) => assignment.playerId === playerId);
  const roomJoinUrl = room && origin ? `${origin}/join?room=${encodeURIComponent(room.code)}` : '';

  function addChip(chip: string) {
    const trigger = `when AI.threatens("${room?.threatType || 'purge'}");`;
    setSource((current) => chip === trigger
      ? (current || `${trigger}\n  `)
      : (current ? `${current}\n  ${chip}` : `${trigger}\n  ${chip}`));
  }

  if (!room) return (
    <main className="landing">
      <div className="brand"><span className="spark">✳</span> GLITCH<span className="dim">/</span>BARGAIN <span className="version">PARTY PROTOCOL 01</span></div>
      <section className="hero">
        <div className="eyebrow"><i/> MULTIPLAYER CHAOS ENGINE</div>
        <h1>Hack the system.<br/><em>Bluff your friends.</em></h1>
        <p className="intro">Write questionable pseudo-code, make suspicious claims, and survive the AI&apos;s purge. One room. Up to 16 players. No downloads.</p>
        <div className="joinbox">
          <label>YOUR CALLSIGN</label>
          <input placeholder="e.g. Spoon Bandit" value={name} maxLength={20} onChange={(event) => setName(event.target.value)}/>
          <div className={`serverstatus ${serverConnected ? 'online' : ''}`}><i/>{serverConnected ? 'GAME SERVER CONNECTED' : 'CONNECTING TO GAME SERVER'}</div>
          <div className="actions">
            <button className="primary" onClick={create}>CREATE ROOM <span>↗</span></button>
            <div className="or">OR JOIN</div>
            <input className={`roomcode${lockRoomCode ? ' roomcode-locked' : ''}`} placeholder="ROOM CODE" aria-label="Room code" title={lockRoomCode ? 'Room code came from your invite link' : undefined} readOnly={lockRoomCode} value={code} maxLength={6} onChange={(event) => setCode(event.target.value.toUpperCase())}/>
            <button className="join" onClick={join}>JOIN <span>→</span></button>
          </div>
          {err && <div className="error">{err}</div>}
        </div>
        <div className="footnote"><span>◉ 1–16 PLAYERS</span><span>◷ SOLO OR MULTIPLAYER</span><span>⌁ MOBILE READY</span></div>
      </section>
      <aside className="decoration"><div className="ring r1"/><div className="ring r2"/><div className="orb">CORE<br/><b>OFFLINE</b></div><div className="floating f1">PARSER // READY</div><div className="floating f2">TRUST NO ONE_</div><div className="scan"/></aside>
      <div className="corner">IN THE EVENT OF A GLITCH<br/>PLEASE BLAME THE PLAYERS.</div>
      <footer className="siteFooter">copyright, created by Sampson Adade (2026)</footer>
    </main>
  );

  const solo = room.mode === 'solo';
  const raid = room.mode === 'raid';
  const targetText = solo && room.aiName ? room.aiName : opponentName;
  const soloRequiredCodeLines = room.requiredCode;
  const clickAddCount = Math.min(soloRequiredCodeLines.length - 2, 2 + room.campaignStage - 1);
  const visibleChips = solo ? soloRequiredCodeLines.slice(0, clickAddCount) : raid ? [] : chips;
  const placeholder = solo || raid
    ? 'Type the required lines here. Every code line ends with a semicolon.'
    : `when AI.threatens("${room.threatType}");\n  require player.holding("metal");\n  define target as "${targetText}";\n  trigger bypass on player;`;
  const title = room.phase === 'LOBBY' ? 'Choose how to play'
      : room.phase === 'GAME_OVER' ? 'Simulation complete'
        : room.phase === 'FUSION_SELECT' ? 'Choose a fusion'
      : room.phase === 'CAMPAIGN_BREAK' ? 'Campaign tier cleared'
        : room.phase === 'ALLY_SELECT' ? 'Choose your AI ally'
              : room.phase === 'HACKING' ? (raid ? 'Breach the raid boss' : 'Make your move')
        : room.phase === 'COUNTER_CODING' ? 'The AI is counter-coding'
          : room.phase === 'CHALLENGE' ? 'Call the bluff'
            : room.phase === 'ADJUDICATING' ? 'Adjudicating the round'
              : room.phase === 'RESOLUTION' ? 'Round verdict'
                : 'Review the code';
  const mainClass = `game${room.phase === 'HACKING' && seconds <= 10 && seconds > 0 ? ' countdown-critical' : ''}${erasureActive ? ' code-eroding' : ''}`;

  return (
    <main className={mainClass}>
      <header className="top">
        <div className="brand small"><span className="spark">✳</span> GLITCH<span className="dim">/</span>BARGAIN</div>
        <div className="topactions">
          <button className="roomTag roomShare" onClick={copyInviteLink} aria-label="Copy room invite link">ROOM <b>{room.code}</b><span className={copied ? 'copied' : ''}>{copied ? 'LINK COPIED!' : 'COPY LINK'}</span></button>
          <button className="backButton" onClick={goBack}>← BACK</button>
          <button className="restartButton" disabled={!me?.host || room.phase !== 'GAME_OVER'} title={room.phase === 'GAME_OVER' ? 'Restart with the same players and settings' : 'Restart unlocks when the game ends'} onClick={restartGame}>RESTART GAME</button>
          <button className="homeButton" onClick={goHome}>GO HOME</button>
        </div>
      </header>

      <div className="gamegrid">
        <section className="maincol">
          <div className="roundhead">
            <div>
              <div className="eyebrow">{room.phase === 'LOBBY' ? 'WAITING ROOM' : solo ? `TIER ${room.campaignStage} · BOSS ${room.round || 'SELECT'} / ${room.rounds}` : raid ? `CO-OP RAID · ROUND ${room.round} / ${room.rounds}` : `ROUND ${room.round} / ${room.rounds}`}</div>
              <h1>{!me?.alive && room.phase !== 'LOBBY' ? 'Glitch spectator' : title}</h1>
            </div>
            {room.deadline && <div className="timer"><span>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span><small>{room.phase.replace('_', ' ')}</small></div>}
          </div>

          {room.phase === 'LOBBY' ? <>
            {me?.host && <div className="modechoices" role="group" aria-label="Choose game mode">
              <button className={`modechoice ${solo ? 'selected' : ''}`} aria-pressed={solo} onClick={() => socket?.emit('room:configure', { mode: 'solo' })}><strong>SOLO</strong><span>Take on AI bosses alone</span></button>
              <button className={`modechoice ${room.mode === 'multiplayer' ? 'selected' : ''}`} aria-pressed={room.mode === 'multiplayer'} onClick={() => socket?.emit('room:configure', { mode: 'multiplayer' })}><strong>MULTIPLAYER</strong><span>Invite your friends</span></button>
              <button className={`modechoice ${raid ? 'selected' : ''}`} aria-pressed={raid} onClick={() => socket?.emit('room:configure', { mode: 'raid' })}><strong>CO-OP RAID</strong><span>Split the boss exploit across your crew</span></button>
            </div>}
            <div className="threat lobbyhint"><div className="eyebrow">{solo ? 'SOLO CAMPAIGN' : raid ? 'CO-OP RAID BRIEFING' : 'WAITING ROOM'}</div><p>{solo ? 'Beat each named AI boss in sequence. Clear a tier to choose one captured AI for your next fusion.' : raid ? `Each connected operative types their assigned lines. Required total: 3 + (living operatives × 2) = ${room.requiredCodeLines}.` : `Share room code ${room.code} with a friend. Start when at least two players are here.`}</p></div>
            {me?.host && <>
              <div className="settings">
                <label>AI PERSONALITY</label>
                <select value={personality} onChange={(event) => { setPersonality(event.target.value); socket?.emit('room:configure', { personality: event.target.value }); }}><option value="glitch">GL1TCH-9 · UNHINGED</option><option value="corporate">C.O.R.E. · CORPORATE</option><option value="villain">DREAD-OMEGA · VILLAIN</option></select>
                <label>ROUNDS</label>
                <select value={rounds} onChange={(event) => { setRounds(Number(event.target.value)); socket?.emit('room:configure', { rounds: Number(event.target.value) }); }}>{[3, 4, 5, 6, 7].map((count) => <option key={count} value={count}>{count} ROUNDS</option>)}</select>
              </div>
              <div className="eyebrow difficultyLabel">SELECT DIFFICULTY</div>
              <div className="difficultyChoices" role="group" aria-label="Select difficulty">
                {difficultyOptions.map((option) => <button key={option.id} className={`difficultyChoice ${difficulty === option.id ? 'selected' : ''}`} aria-pressed={difficulty === option.id} onClick={() => { setDifficulty(option.id); socket?.emit('room:configure', { difficulty: option.id }); }}><strong>{option.label}</strong><span>{option.seconds} SECONDS</span></button>)}
              </div>
              <button disabled={solo ? room.players.length !== 1 : room.players.filter((player) => player.connected && player.alive).length < 2} className="primary full" onClick={() => socket?.emit('game:start')}>{solo ? 'START SOLO GAME' : raid ? 'START CO-OP RAID' : 'START MULTIPLAYER GAME'} <span>⚡</span></button>
            </>}
          </> : room.phase === 'CAMPAIGN_BREAK' ? <>
            <div className="threat verdict campaignCongrats"><div className="eyebrow">✦ TIER {room.campaignStage} COMPLETE</div><h2>Congratulations! You defeated all the AIs.</h2><p>Your captured AIs are now a roster. Pick one to carry into the next campaign tier.</p><div className="scores"><div><b>CAPTURED</b><span>{room.capturedAis.join(' · ')}</span><strong>{room.capturedAis.length}</strong></div></div></div>
            <div className="submitted">NEXT TIER STARTS WITH ONE BOSS AT A TIME. ALLY SELECTION OPENS IN A MOMENT.</div>
          </> : room.phase === 'FUSION_SELECT' ? <>
            <div className="threat verdict fusionPrompt"><div className="eyebrow">BOSS CAPTURED · CHOICE REQUIRED</div><h2>{room.allies.find((ally) => ally.id === room.pendingMergeAiId)?.name || 'The defeated AI'}</h2><p>Choose one AI you already own to merge this capture into, or keep the new AI independent in your roster. Fusions raise rank and give a small code-stability bonus.</p></div>
            <div className="allyGrid">{room.allies.filter((ally) => ally.id !== room.pendingMergeAiId).map((ally) => <button key={ally.id} className={`allyCard ${mergeTargetAllyId === ally.id ? 'selected' : ''}`} aria-pressed={mergeTargetAllyId === ally.id} onClick={() => setMergeTargetAllyId(ally.id)}><span className="allyRank">FUSION RANK {ally.rank}</span><strong>{ally.name}</strong><small>COMPONENTS: {ally.components.join(' + ')}</small><em>Merge the new capture into this AI.</em></button>)}</div>
            {mergeTargetAllyId && <button className="primary full" onClick={() => resolveFusion(mergeTargetAllyId)}>CONFIRM FUSION WITH {room.allies.find((ally) => ally.id === mergeTargetAllyId)?.name} <span>⟷</span></button>}
            <button className="keepAloneButton" onClick={() => resolveFusion(null)}>KEEP {room.allies.find((ally) => ally.id === room.pendingMergeAiId)?.name} SEPARATE</button>
          </> : room.phase === 'ALLY_SELECT' ? <>
            <div className="threat lobbyhint campaignIntro"><div className="eyebrow">TIER {room.campaignStage} · FUSION PREPARATION</div><p>Choose one captured AI to prompt once per boss. It will autofill up to half the required code, starting after your verified lines; you type the rest. After each victory, choose what to fuse or keep independent. Required code starts at 1.5× the first tier, then increases at an accelerating but gradual pace.</p><div className="fusionRules"><span>{room.rounds} BOSSES</span><span>{room.requiredCodeLines} REQUIRED CODE LINES</span><span>{clickAddCount} AUTO-ADD BUTTONS</span><span>ERASURE SPEEDS UP EACH TIER</span></div></div>
            <div className="allyGrid">{room.allies.map((ally) => <button key={ally.id} className={`allyCard ${room.selectedAllyId === ally.id ? 'selected' : ''}`} aria-pressed={room.selectedAllyId === ally.id} onClick={() => selectAlly(ally.id)}><span className="allyRank">FUSION RANK {ally.rank}</span><strong>{ally.name}</strong><small>COMPONENTS: {ally.components.join(' + ')}</small><em>{ally.rank > 1 ? 'Fusion stability slows code erasure.' : 'A fresh core, ready to merge.'}</em></button>)}</div>
            <button className="primary full" disabled={!room.selectedAllyId} onClick={continueCampaign}>START TIER {room.campaignStage} <span>⚡</span></button>
          </> : <>
            <div className="threat"><div className="eyebrow"><i className="redpulse"/> INCOMING THREAT</div><p>{room.threat}</p>{(solo || raid) && room.aiName && <div className="aiTarget">{raid ? 'RAID BOSS' : 'CURRENT AI TARGET'} <strong>{room.aiName}</strong></div>}</div>
            {solo && <div className="soloHud"><div className="lifeCount"><span>REMAINING LIVES</span><strong>{room.lives} / {room.maxLives}</strong></div><div className="allies"><span>{room.campaignStage === 1 ? 'AI ROSTER' : 'ACTIVE FUSION'}</span><strong>{room.campaignStage === 1 ? (room.capturedAis.length ? room.capturedAis.join(' · ') : 'NONE YET') : `${room.allies.find((ally) => ally.id === room.selectedAllyId)?.name || 'ALLY'} · RANK ${selectedAllyRank} · OBEDIENCE TIER ${room.allies.find((ally) => ally.id === room.selectedAllyId)?.obedienceTier ?? 1}`}</strong></div></div>}
            {raid && <div className="raidHud"><span>{room.raidParticipantCount} OPERATIVES</span><span>{room.requiredCodeLines} TOTAL LINES</span><span>ERASURE EVERY {room.raidErasureIntervalMs}MS</span></div>}

            {room.phase === 'HACKING' && me && !me.alive && <div className="submitted">YOU WERE PURGED. WATCH THE CREW AS A GLITCH SPECTATOR.</div>}
            {room.phase === 'HACKING' && me?.alive && !submitted && <>
              <div className="terminal">
                <div className="terminalbar"><span className="dots"><i/><i/><i/></span><span>exploit.glitch</span><span className="level">{erasureActive ? 'ERASURE ACTIVE' : solo || raid ? `${room.requiredCodeLines} LINES REQUIRED` : `SYNTAX LVL ${room.syntaxLevel}`}</span></div>
                <textarea ref={codeEditorRef} value={source} onChange={(event) => { setSource(event.target.value); if (event.target.value !== source) queueThermalRoll(); }} spellCheck={false} autoCapitalize="none" autoCorrect="off" placeholder={placeholder}/>
                <div className="terminalfoot">{source.length}/1000{solo && room.campaignStage > 1 ? <span>ALLY AUTOFILLS UP TO {room.allyCodeLineCount}/{room.requiredCodeLines} LINES · YOU TYPE THE REST</span> : raid ? <span>ASSIGNED LINES ONLY · TYPE EACH LINE YOURSELF</span> : <span>MANUAL TYPING BUILDS HEAT · CHIP INSERTIONS DO NOT</span>}</div>
              </div>
              {allyReply && <div className="allyDraft" aria-live="polite"><div className="eyebrow">ALLY RESPONSE · CODE AUTOFILLED</div><p>{allyReply}</p></div>}
              {solo && <div className="requiredCode nonCopyable" onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}><div className="eyebrow">REQUIRED CODE · TYPE THESE LINES</div><ol>{soloRequiredCodeLines.map((line, index) => <li key={`${index}-${line}`}><code>{line}</code></li>)}</ol><small>{clickAddCount} of {soloRequiredCodeLines.length} lines have auto-add buttons. Type every other line yourself.</small></div>}
              {raid && <div className="requiredCode nonCopyable" onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}><div className="eyebrow">YOUR ASSIGNED LINES · TYPE THESE EXACTLY</div><ol>{(raidAssignment?.lines ?? []).map((line, index) => <li key={`${index}-${line}`}><code>{line}</code></li>)}</ol><small>Each living operative owns two lines. The lead operative also writes the three trigger and target lines.</small></div>}
              {visibleChips.length > 0 && <div className="chips">{visibleChips.map((chip) => <button key={chip} disabled={source.split(/\r?\n/).some((line) => line.trim() === chip.trim())} onClick={() => addChip(chip)}>+ {chip}</button>)}</div>}
              {solo && room.campaignStage > 1 && room.selectedAllyId && (() => { const activeAlly = room.allies.find((ally) => ally.id === room.selectedAllyId); const locked = !activeAlly || activeAlly.obedienceTier === 0; return <div className="allyAssist"><label className="eyebrow" htmlFor="allyPrompt">PROMPT YOUR AI ALLY · OPTIONAL</label><input id="allyPrompt" className="allyPrompt" value={allyPrompt} maxLength={160} onChange={(event) => setAllyPrompt(event.target.value)} placeholder="e.g. focus on disabling the boss shield" disabled={room.assistUsed || locked}/><small>Your prompt guides its response. It can only autofill up to half of this round’s required lines.</small><button className={`assistButton${locked ? ' assistLocked' : ''}`} disabled={room.assistUsed || locked} onClick={requestAllyAssist}>{locked ? 'ALLY LOCKED · TIER 0' : room.assistUsed ? 'ALLY SUPPORT SPENT THIS BOSS' : `CALL ${activeAlly?.name} · AUTOFILL UP TO HALF`}</button></div>; })()}
              {erasureActive && <div className="eraseNotice">WARNING // {room.aiName || 'THE RAID BOSS'} IS DELETING CODE FROM THE START · {Math.ceil(1000 / erasureInterval)} CHARS/SEC</div>}
              {me && <div className="thermalHud"><div><span>THERMAL LOAD</span><strong>{me.thermalHeat}%</strong></div><div className="thermalTrack"><i style={{ width: `${me.thermalHeat}%` }}/></div><small>{thermalNotice || 'MANUAL TYPING MAY VENT HEAT OR CAUSE A SPIKE'}</small></div>}
              <button className="primary full" onClick={submit}>{raid ? 'SUBMIT RAID CONTRIBUTION' : 'EXECUTE EXPLOIT'} <span>↗</span></button>
            </>}
            {submitted && room.phase === 'HACKING' && <div className="submitted">✓ {raid ? 'RAID CONTRIBUTION LOCKED IN. WAIT FOR YOUR CREW.' : 'EXPLOIT LOCKED IN. WATCH THE CLOCK.'}</div>}
            {room.phase === 'COUNTER_CODING' && <div className="counterBox"><div className="eyebrow"><i className="redpulse"/> {room.aiName} // COUNTER-CODING</div><p>The timer expired. The AI is attacking your exploit.</p><pre>{room.counterCode}</pre></div>}
            {room.phase === 'REVIEW' && <div className="review"><div className="eyebrow">SUBMISSIONS // OPEN FOR REVIEW</div>{room.submissions.map((submission) => <article key={submission.playerId}><b>{room.players.find((player) => player.id === submission.playerId)?.name}</b><pre>{submission.source}</pre>{!submission.valid && <small>SYNTAX ERRORS: {submission.errors.join(' ')}</small>}</article>)}</div>}
            {room.phase === 'CHALLENGE' && <div className="review"><div className="eyebrow">CLAIMS & CHALLENGES · HOST CAN VERIFY</div>{room.submissions.map((submission) => <article key={submission.playerId}><b>{room.players.find((player) => player.id === submission.playerId)?.name}</b><pre>{submission.source}</pre>{submission.claims.length === 0 ? <small>NO PHYSICAL CLAIMS</small> : submission.claims.map((claim, index) => <div className="claimrow" key={index}><span>CLAIM: player.{claim.type}(&quot;{claim.item}&quot;) · {claim.verified === true ? 'VERIFIED' : claim.verified === false ? 'FALSE' : 'UNVERIFIED'}</span>{me?.host && <><button className="verify" onClick={() => verifyClaim(submission.playerId, index, true)}>✓ TRUE</button><button className="verify false" onClick={() => verifyClaim(submission.playerId, index, false)}>✕ FALSE</button></>}{me?.alive && submission.playerId !== playerId && !room.challenges.some((challengeEntry) => challengeEntry.challengerId === playerId) && <button className="challenge" onClick={() => challenge(submission.playerId, index)}>GIT REJECT ↗</button>}</div>)}</article>)}</div>}
            {room.phase === 'ADJUDICATING' && <div className="submitted">THE AI IS REVIEWING NORMALIZED GAME DATA…</div>}
            {room.phase === 'RESOLUTION' && <div className="threat verdict"><div className="eyebrow">{solo ? room.soloOutcome === 'success' ? 'AI CAPTURED' : 'LIFE LOST' : 'SYSTEM VERDICT'}</div><p>{room.narration || 'Evaluating claims and calculating scores…'}</p><div className="scores">{[...room.players].sort((a, b) => b.score - a.score).map((player, index) => <div key={player.id}><b>{String(index + 1).padStart(2, '0')}</b> {player.name}<strong>{player.score}</strong></div>)}</div></div>}
            {room.phase === 'GAME_OVER' && <div className="threat verdict"><div className="eyebrow">{solo ? me?.alive ? 'CAMPAIGN COMPLETE' : 'AI DEFEAT' : 'FINAL LEADERBOARD'}</div><p>{room.narration}</p><div className="scores">{[...room.players].sort((a, b) => b.score - a.score).map((player, index) => <div key={player.id}><b>{String(index + 1).padStart(2, '0')}</b> {player.name}<strong>{player.score}</strong></div>)}</div></div>}
          </>}

          {room.deadline && <div className="progress"><div style={{ width: `${progress}%` }}/></div>}
          {room.terminalEvents.length > 0 && <div className="terminalLog" aria-live="polite"><div className="eyebrow">GLOBAL TERMINAL BROADCAST</div>{room.terminalEvents.slice(-5).map((event) => <div key={event.id} className={`terminalEvent ${event.tone}`}>{event.message}</div>)}</div>}
          {room.phase !== 'GAME_OVER' && <div className="roster"><div className="eyebrow">CONNECTED OPERATIVES <span>{room.players.length}/16</span></div>{room.players.map((player) => <div className="player" key={player.id}><i className={player.connected ? 'online' : ''}/><span>{player.name}{player.host && <small> HOST</small>}{!player.alive && <small> GLITCH SPECTATOR</small>}</span><b>{player.score}</b>{room.phase === 'CHALLENGE' && room.challenges.some((challengeEntry) => challengeEntry.challengerId === playerId && challengeEntry.targetPlayerId === player.id) && <small>CHALLENGED</small>}</div>)}</div>}
          <div className="globalerror">{err}</div>
        </section>

        <aside className="side">
          <div className="sidecard roomCodeCard"><div className="eyebrow">ROOM LINK</div><button className="roomCodeButton" onClick={copyInviteLink} aria-label="Copy room invite link"><strong>{room.code}</strong><span className={copied ? 'copied' : ''}>{copied ? 'LINK COPIED!' : 'TAP TO COPY INVITE'}</span></button><p>Scan the QR or copy the invite link. It opens this room with the code already filled in.</p>{roomJoinUrl && <div className="qrCanvas"><QRCodeSVG value={roomJoinUrl} size={144} level="M" bgColor="#ffffff" fgColor="#080a0d" title={`Join room ${room.code}`} /></div>}</div>
          <div className="sidecard protocol"><div className="eyebrow">HOW TO SURVIVE</div><ol>{solo ? <><li><b>CODE</b><span>Target the named AI, bypass the trigger on your callsign, then lock down the AI.</span></li><li><b>EXTRACT</b><span>Clear every boss in a tier, then choose one captured AI to carry forward.</span></li><li><b>FUSE</b><span>Prompt your ally and call it once per boss. It autofills up to half the required lines; type the rest. After each win, choose an owned AI to fuse the new capture into or keep it separate.</span></li><li><b>SURVIVE</b><span>Enemies erase code from the start in the final five seconds. Erasure speeds up by tier; each failure costs a life.</span></li></> : raid ? <><li><b>DIVIDE</b><span>The lead writes the trigger and target; every operative gets two personal lines.</span></li><li><b>TYPE</b><span>Enter your assigned lines exactly. The boss requires 3 + (living players × 2) lines.</span></li><li><b>RACE</b><span>More operatives extend the timer and make code erasure faster.</span></li><li><b>BREACH</b><span>Every connected operative must submit before the timer ends.</span></li></> : <><li><b>WRITE</b><span>Build an exploit using the allowed syntax.</span></li><li><b>BLUFF</b><span>Physical claims are yours to make.</span></li><li><b>CHALLENGE</b><span>Call out a suspicious claim.</span></li><li><b>SURVIVE</b><span>Outscore your friends.</span></li></>}</ol></div>
          {solo && room.capturedAis.length > 0 ? <div className="sidequote">ROSTER: {room.capturedAis.join(' · ')}<small>{room.campaignStage > 1 ? `ACTIVE FUSION: ${room.allies.find((ally) => ally.id === room.selectedAllyId)?.components.join(' + ') || 'SELECT AN ALLY'}` : 'CHOOSE ONE AFTER CLEARING THIS TIER'}</small></div> : <div className="sidequote">“I WILL DELETE ANYONE WEARING BLUE.”<small>— THE AI, PROBABLY</small></div>}
        </aside>
      </div>
      <footer className="siteFooter">copyright, created by Sampson Adade (2026)</footer>
    </main>
  );
}
