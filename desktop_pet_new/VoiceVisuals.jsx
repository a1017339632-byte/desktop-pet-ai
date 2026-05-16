// ==========================================================
// VoiceVisuals.jsx — 三种声浪 + 四种思考脉冲
// 可以 <VoiceOrb variant="gpt|halo|multi" state="idle|listening|speaking|thinking" hue={n} sensitivity={n} />
// 或 <WaveBars bars={39} state="..." hue={n} sensitivity={n} />
// ==========================================================

// ——— 单球 GPT 风 ———
const VoiceOrb = ({ variant = "gpt", state = "idle", hue = 260, sensitivity = 1, size = 220 }) => {
  const base = `oklch(0.75 0.18 ${hue})`;
  const c2 = `oklch(0.7 0.18 ${hue + 30})`;
  const c3 = `oklch(0.72 0.16 ${hue - 30})`;

  if (variant === "gpt") {
    return (
      <div className={`vorb vorb-gpt vorb-${state}`} style={{ width: size, height: size, '--hue': hue, '--sens': sensitivity }}>
        <div className="vorb-gpt-halo"></div>
        <div className="vorb-gpt-body" style={{
          background: `conic-gradient(from 0deg, ${base}, ${c2}, ${c3}, ${base})`
        }}>
          <div className="vorb-gpt-inner" style={{
            background: `radial-gradient(circle at 30% 30%, oklch(0.95 0.08 ${hue}) 0%, ${base} 40%, ${c2} 80%)`
          }}></div>
          <div className="vorb-gpt-noise"></div>
        </div>
      </div>
    );
  }
  if (variant === "halo") {
    return (
      <div className={`vorb vorb-halo vorb-${state}`} style={{ width: size, height: size, '--hue': hue, '--sens': sensitivity }}>
        <div className="vorb-halo-ring vorb-halo-ring-1"></div>
        <div className="vorb-halo-ring vorb-halo-ring-2"></div>
        <div className="vorb-halo-ring vorb-halo-ring-3"></div>
        <div className="vorb-halo-core" style={{
          background: `radial-gradient(circle at 35% 35%, oklch(0.9 0.14 ${hue}) 0%, ${base} 50%, ${c3} 100%)`
        }}></div>
      </div>
    );
  }
  // multi — 多层错位
  return (
    <div className={`vorb vorb-multi vorb-${state}`} style={{ width: size, height: size, '--hue': hue, '--sens': sensitivity }}>
      <div className="vorb-multi-layer vorb-multi-l1" style={{ background: `radial-gradient(circle, oklch(0.78 0.18 ${hue + 40} / 0.5), transparent 70%)` }}></div>
      <div className="vorb-multi-layer vorb-multi-l2" style={{ background: `radial-gradient(circle, oklch(0.75 0.18 ${hue - 40} / 0.5), transparent 70%)` }}></div>
      <div className="vorb-multi-layer vorb-multi-l3" style={{ background: `radial-gradient(circle, oklch(0.72 0.16 ${hue} / 0.6), transparent 70%)` }}></div>
      <div className="vorb-multi-core" style={{
        background: `radial-gradient(circle at 35% 35%, oklch(0.92 0.12 ${hue}) 0%, ${base} 60%)`
      }}></div>
    </div>
  );
};

// ——— 均衡器柱条 ———
const WaveBars = ({ bars = 39, state = "speaking", hue = 260, sensitivity = 1 }) => {
  const arr = React.useMemo(() => Array.from({ length: bars }, (_, i) => {
    // a pseudo-organic shape centered in middle
    const center = bars / 2;
    const dist = Math.abs(i - center) / center;
    const base = (1 - Math.pow(dist, 1.5)) * 0.8 + 0.2;
    return { base, delay: (i * 40) % 600, dur: 600 + ((i * 73) % 400) };
  }), [bars]);

  return (
    <div className={`wave-bars wave-bars-${state}`} style={{ '--hue': hue, '--sens': sensitivity }}>
      {arr.map((b, i) => (
        <div key={i} className="wave-bar" style={{
          '--base': b.base,
          '--delay': `${b.delay}ms`,
          '--dur': `${b.dur}ms`,
        }}></div>
      ))}
    </div>
  );
};

// ——— 思考脉冲 (四个变体) ———
const ThinkPulse = ({ variant = "breathe", hue = 45, size = 100 }) => {
  const base = `oklch(0.85 0.16 ${hue})`;
  const base2 = `oklch(0.75 0.17 ${hue + 20})`;

  if (variant === "breathe") {
    return (
      <div className="tpulse tpulse-breathe" style={{ width: size, height: size, '--hue': hue }}>
        <div className="tpulse-core" style={{ background: `radial-gradient(circle at 35% 30%, ${base}, ${base2})` }}></div>
      </div>
    );
  }
  if (variant === "flow") {
    return (
      <div className="tpulse tpulse-flow" style={{ width: size, height: size, '--hue': hue }}>
        <div className="tpulse-core" style={{ background: `radial-gradient(circle at 35% 30%, ${base}, ${base2})` }}></div>
        <div className="tpulse-edge"></div>
      </div>
    );
  }
  if (variant === "inner") {
    return (
      <div className="tpulse tpulse-inner" style={{ width: size, height: size, '--hue': hue }}>
        <div className="tpulse-core" style={{
          background: `conic-gradient(from 0deg, ${base}, ${base2}, oklch(0.75 0.17 ${hue - 30}), ${base})`
        }}></div>
      </div>
    );
  }
  // layered
  return (
    <div className="tpulse tpulse-layered" style={{ width: size, height: size, '--hue': hue }}>
      <div className="tpulse-halo tpulse-halo-1"></div>
      <div className="tpulse-halo tpulse-halo-2"></div>
      <div className="tpulse-core" style={{ background: `radial-gradient(circle at 35% 30%, ${base}, ${base2})` }}></div>
    </div>
  );
};

Object.assign(window, { VoiceOrb, WaveBars, ThinkPulse });
