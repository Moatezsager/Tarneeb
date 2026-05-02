const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
let audioCtx: AudioContext | null = null;

export function initAudio() { 
  if (!audioCtx && AudioCtx) audioCtx = new AudioCtx(); 
}

export function beep(f: number, d: number, t: OscillatorType = 'sine', v = 0.05) {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type=t; 
    o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+d);
    o.connect(g); 
    g.connect(audioCtx.destination);
    o.start(); 
    o.stop(audioCtx.currentTime+d);
  } catch(e) {}
}

export const sfxSelect = () => beep(700, 0.06);
export const sfxPlay = () => beep(500, 0.08);
export const sfxWin = () => { beep(900, 0.1); setTimeout(() => beep(1100, 0.1), 100); };
export const sfxBid = () => beep(350, 0.08, 'square');
export const sfxTrap = () => beep(180, 0.35, 'sawtooth', 0.12);
export const sfxTarneb = () => { beep(600, 0.15, 'triangle', 0.08); setTimeout(() => beep(800, 0.2, 'triangle', 0.1), 150); };
export const sfxDeal = () => beep(800 + Math.random() * 400, 0.03 + Math.random() * 0.02, 'sine', 0.02);
export const sfxRoundEnd = () => [500, 600, 700, 900].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'triangle', 0.07), i * 120));
