// ============================================================
// Pet.jsx — 煊煊画的小狗桌宠
// 状态: idle / happy / angry / shocked / sleep / thinking / listening / speaking / poke / sad
// ============================================================

const PET_IMAGES = {
  idle: "assets/pet_idle.png",
  happy: "assets/pet_idle.png",
  sad: "assets/pet_idle.png",
  sleep: "assets/pet_idle.png",
  thinking: "assets/pet_idle.png",
  listening: "assets/pet_idle.png",
  speaking: "assets/pet_idle.png",
  angry: "assets/pet_angry.png",
  poke: "assets/pet_shocked.png",
  shocked: "assets/pet_shocked.png",
  run: "assets/pet_angry.png",
  peek: "assets/pet_idle.png",
};

const Pet = ({ size = 220, hue = 25, state = "idle", limbsVisible = true }) => {
  const imgSrc = PET_IMAGES[state] || PET_IMAGES.idle;

  const bodyAnim =
    state === "thinking" ? "pet-anim-thinking" :
    state === "speaking" ? "pet-anim-speaking" :
    state === "listening" ? "pet-anim-listening" :
    state === "sleep" ? "pet-anim-sleep" :
    state === "poke" ? "pet-anim-poke" :
    state === "happy" ? "pet-anim-happy" :
    "pet-anim-idle";

  return (
    <div className={`pet-wrap ${bodyAnim}`} style={{ width: size, height: size, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img
        src={imgSrc}
        alt="桌宠"
        style={{
          maxWidth: "90%",
          maxHeight: "90%",
          objectFit: "contain",
          filter: `hue-rotate(${(hue - 25)}deg)`,
          transition: "filter 0.3s",
          userSelect: "none",
          pointerEvents: "none",
        }}
        draggable={false}
      />
      {state === "sleep" && <div className="pet-zzz" style={{ position: "absolute", top: "10%", right: "15%", fontSize: 18, opacity: 0.7 }}>
        <span style={{ animation: "zzz-float 1.5s ease infinite" }}>z</span>
        <span style={{ animation: "zzz-float 1.5s ease 0.3s infinite", fontSize: 22 }}>Z</span>
        <span style={{ animation: "zzz-float 1.5s ease 0.6s infinite" }}>z</span>
      </div>}
      {state === "thinking" && <div style={{ position: "absolute", bottom: "5%", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>思考中...</div>}
    </div>
  );
};

Object.assign(window, { Pet });
