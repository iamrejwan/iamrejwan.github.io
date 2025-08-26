import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, OrbitControls, Stars, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Rejwan 3D Portfolio — React + @react-three/fiber
 * Neon terminal vibe + upgraded interactivity:
 * - Magnetic cursor light, planet magnetism, pulse rings on click
 * - Particle field, grid floor, code-rain HUD
 * - Typewriter 3D intro ("> whoami")
 * - Satellite orbiters follow active planet
 */
const GITHUB_USER = "iamrejwan";

// ---------------- GitHub Data Hook ----------------
function useGitHubData(username = GITHUB_USER) {
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let abort = new AbortController();
    const headers = {};
    if (window.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${window.GITHUB_TOKEN}`;
    async function run() {
      try {
        setLoading(true);
        const u = await fetch(`https://api.github.com/users/${username}`, { headers, signal: abort.signal }).then(r => r.json());
        const r = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers, signal: abort.signal }).then(r => r.json());
        if (u?.message === "Not Found") throw new Error("GitHub user not found");
        setUser(u);
        let list = Array.isArray(r) ? r.filter(x => !x.fork) : [];
        list = list.map(x => ({
          id: x.id, name: x.name, html_url: x.html_url, description: x.description,
          stargazers_count: x.stargazers_count, language: x.language, updated_at: x.updated_at, topics: x.topics || []
        }));
        list.sort((a,b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.updated_at) - new Date(a.updated_at)));
        setRepos(list);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    }
    run();
    return () => abort.abort();
  }, [username]);

  return { user, repos, loading, error };
}

// ---------------- Utils ----------------
function useCursorWorld() {
  const { camera, mouse } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  return () => {
    v.set(mouse.x, mouse.y, 0.5).unproject(camera);
    return v.clone();
  };
}

// ---------------- FX Components ----------------
function CursorLight() {
  const ref = useRef();
  const getWorld = useCursorWorld();
  useFrame(() => {
    const target = getWorld();
    ref.current.position.lerp(target, 0.12);
  });
  return <pointLight ref={ref} intensity={2.2} distance={18} decay={2} color="#22d3ee" />;
}

function ParticleField({ count = 1200 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 80;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 40;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    return arr;
  }, [count]);
  useFrame((_, d) => {
    ref.current.rotation.y += d * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach='attributes-position' array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.06} sizeAttenuation color="#34d399" transparent opacity={0.5} />
    </points>
  );
}

function GridFloor() {
  return (
    <group position={[0,-3.6,0]}>
      <gridHelper args={[120, 80, "#14b8a6", "#0ea5e9"]} />
    </group>
  );
}

function SpinningKnot(props) {
  const ref = useRef();
  useFrame((_, d) => {
    ref.current.rotation.x += d * 0.25;
    ref.current.rotation.y += d * 0.18;
  });
  return (
    <Float floatIntensity={1.6} rotationIntensity={0.7} speed={1.1}>
      <group {...props}>
        <mesh ref={ref}>
          <torusKnotGeometry args={[1.05, 0.28, 220, 32]} />
          <meshStandardMaterial color="#22d3ee" metalness={0.5} roughness={0.15} emissive="#0ea5e9" emissiveIntensity={0.6} />
        </mesh>
        <mesh>
          <torusKnotGeometry args={[1.08, 0.29, 100, 16]} />
          <meshBasicMaterial wireframe color="#67e8f9" opacity={0.4} transparent />
        </mesh>
      </group>
    </Float>
  );
}

function Glow({ position = [0,0,0], color = "#88ccff", radius = 2.6 }) {
  const size = radius * 4;
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128; const g = c.getContext("2d");
    const grd = g.createRadialGradient(64,64,10,64,64,64);
    g.clearRect(0,0,128,128); grd.addColorStop(0,"rgba(255,255,255,0.9)"); grd.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle = grd; g.beginPath(); g.arc(64,64,64,0,Math.PI*2); g.fill();
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }, []);
  return (
    <sprite position={position} scale={[size,size,1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function PulseRing({ origin, onDone }) {
  const ref = useRef();
  const t0 = useRef(performance.now());
  useFrame(() => {
    const t = (performance.now() - t0.current) / 1000;
    const s = 1 + t * 5; // expand
    const a = Math.max(0, 0.5 - t * 0.45); // fade
    ref.current.scale.setScalar(s);
    ref.current.material.opacity = a;
    if (t > 1.2) onDone?.();
  });
  return (
    <mesh position={origin} ref={ref} rotation={[-Math.PI/2,0,0]}> 
      <ringGeometry args={[0.8, 0.82, 64]} />
      <meshBasicMaterial color="#22d3ee" transparent />
    </mesh>
  );
}

function Orbiters({ targetRef, active }) {
  const a = useRef(0);
  const s1 = useRef();
  const s2 = useRef();
  useFrame((_, d) => {
    a.current += d * 1.2;
    const base = new THREE.Vector3();
    if (targetRef?.current) targetRef.current.getWorldPosition(base);
    const r1 = 2.2, r2 = 3.2;
    if (s1.current) s1.current.position.set(base.x + Math.cos(a.current) * r1, base.y + Math.sin(a.current*1.3) * 0.6, base.z + Math.sin(a.current) * r1);
    if (s2.current) s2.current.position.set(base.x + Math.cos(-a.current*0.8) * r2, base.y + Math.sin(a.current*0.6) * 0.4, base.z + Math.sin(-a.current*0.8) * r2);
  });
  if (!active) return null;
  return (
    <group>
      <mesh ref={s1}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#a7f3d0" emissive="#34d399" emissiveIntensity={0.6} />
      </mesh>
      <mesh ref={s2}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

const Planet = React.forwardRef(function Planet({ label, color = "#fff", position = [0, 0, 0], onActivate, active }, ref) {
  const local = useRef();
  const hover = useRef(false);
  const getWorld = useCursorWorld();
  useFrame((_, d) => {
    const targetScale = hover.current || active ? 1.18 : 1.0;
    local.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
    const world = getWorld();
    const here = local.current.position.clone();
    const dir = world.clone().sub(here).multiplyScalar(0.0025);
    local.current.position.add(dir);
    local.current.rotation.y += d * 0.35;
  });
  const handleClick = () => {
    const wp = new THREE.Vector3(); local.current.getWorldPosition(wp);
    onActivate?.(label, wp);
  };
  return (
    <group ref={ref} position={position}>
      <Glow position={[0,0,0]} color={color} radius={active ? 3.1 : 2.6} />
      <mesh
        ref={local}
        onPointerOver={() => (hover.current = true)}
        onPointerOut={() => (hover.current = false)}
        onClick={handleClick}
        castShadow receiveShadow
      >
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.25} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.205, 2]} />
        <meshBasicMaterial wireframe color={"white"} opacity={0.15} transparent />
      </mesh>
      <Text fontSize={0.42} position={[0, -1.8, 0]} anchorX="center" anchorY="middle" maxWidth={4}>
        {label}
      </Text>
    </group>
  );
});

function Header3D({ name = "REJWAN", tagline = "Full Stack Android Developer" }) {
  const group = useRef();
  useFrame(({ mouse }) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, mouse.x * 0.2, 0.05);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -mouse.y * 0.2, 0.05);
  });
  return (
    <group ref={group} position={[0, 1.2, 0]}>
      <Text fontSize={1.05} anchorX="center" anchorY="middle">
        {name.toUpperCase()}
      </Text>
      <Text fontSize={0.34} position={[0, -0.9, 0]}>
        {tagline}
      </Text>
    </group>
  );
}

// ---------------- Typewriter 3D Intro ----------------
function Typewriter3D({ lines = ["> whoami", "Rejwan — Full Stack Android Developer"], position = [0, 2.2, 0], color = "#22d3ee" }) {
  const [i, setI] = useState(0);
  const [j, setJ] = useState(0);
  const [visibleLines, setVisibleLines] = useState([""]);
  const group = useRef();
  const speed = 28; // chars per second
  const lineDelay = 0.6; // seconds between lines
  const t0 = useRef(performance.now());

  useFrame(() => {
    if (group.current) {
      group.current.position.lerp(new THREE.Vector3(position[0], position[1] + 0.25, position[2]), 0.06);
      group.current.scale.lerp(new THREE.Vector3(1,1,1), 0.08);
    }
  });

  useEffect(() => {
    let raf;
    const tick = () => {
      setVisibleLines(ls => {
        const cur = lines[i] || "";
        const next = cur.slice(0, j);
        const newLs = [...ls];
        newLs[i] = next + ((Date.now() % 700) < 350 ? "_" : " ");
        return newLs;
      });
      setJ(prev => prev + Math.max(1, Math.round(speed / 30)));

      if (j >= (lines[i] || "").length + 2) { // pause at end
        if (i < lines.length - 1) {
          setTimeout(() => {
            setI(i + 1);
            setJ(0);
            setVisibleLines(v => [...v, ""]);
          }, lineDelay * 1000);
        } else {
          cancelAnimationFrame(raf);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, j]);

  return (
    <group ref={group} position={position} scale={[0.98,0.98,0.98]}>
      {visibleLines.map((txt, idx) => (
        <Text key={idx} fontSize={idx === 0 ? 0.36 : 0.32} position={[0, -idx*0.42, 0]} anchorX="center" anchorY="middle" color={color}>
          {txt}
        </Text>
      ))}
    </group>
  );
}

// ---------------- HUD / UI ----------------
function CodeRain() {
  return (
    <Html fullscreen zIndexRange={[0, 0]}>
      <style>{`
        .rain { position: absolute; inset: 0; pointer-events:none; mix-blend-mode: screen; opacity:.12; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace; }
        .col { position:absolute; top:-110%; width:1.2ch; color:#10b981; text-shadow:0 0 8px #10b981; animation: fall linear infinite; white-space:pre; }
        @keyframes fall { to { transform: translateY(220%);} }
      `}</style>
      <div className="rain">
        {Array.from({length: 28}).map((_,i)=>{
          const dur = 6 + Math.random()*6; const left = (i/28)*100; const delay = -Math.random()*dur;
          const chars = "01<>\\/={}[]();$#@*&^%";
          const lines = Array.from({length: 40}).map(()=> chars[Math.floor(Math.random()*chars.length)]).join("\\n");
          return <pre key={i} className="col" style={{left:`${left}%`, animationDuration:`${dur}s`, animationDelay:`${delay}s`}}>{lines}</pre>
        })}
      </div>
    </Html>
  );
}

function StatChip({ children }) {
  return <span className="px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-300/20 backdrop-blur text-xs font-mono">{children}</span>;
}

function RepoCard({ repo }) {
  return (
    <a href={repo.html_url} target="_blank" rel="noreferrer" className="block group">
      <div className="rounded-xl p-4 border border-emerald-300/20 bg-black/40 hover:bg-black/55 transition shadow-[0_0_40px_rgba(16,185,129,0.08)] font-mono">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm md:text-base font-semibold tracking-tight group-hover:text-emerald-300 transition-colors">{repo.name}</h3>
          <div className="text-xs opacity-75">★ {repo.stargazers_count || 0}</div>
        </div>
        {repo.description && (
          <p className="mt-1 text-xs md:text-sm opacity-80 line-clamp-2">{repo.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {repo.language && <StatChip>{repo.language}</StatChip>}
          {repo.topics?.slice(0, 3).map(t => (
            <StatChip key={t}>#{t}</StatChip>
          ))}
          <span className="text-[10px] opacity-60 ml-auto">Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </a>
  );
}

function RepoList({ repos = [], currentFilter }) {
  const filtered = React.useMemo(() => {
    if (!currentFilter || currentFilter === "All") return repos;
    return repos.filter(r => (r.language || "").toLowerCase() === currentFilter.toLowerCase());
  }, [repos, currentFilter]);
  const top = filtered.slice(0, 8);
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
      {top.map(r => <RepoCard key={r.id} repo={r} />)}
      {top.length === 0 && (
        <div className="col-span-full text-sm opacity-80 font-mono">No repositories matched that filter.</div>
      )}
    </div>
  );
}

// ---------------- Main Component ----------------
export default function RejwanPortfolio() {
  const { user, repos, loading, error } = useGitHubData(GITHUB_USER);
  const [filter, setFilter] = useState("All");
  const [pulses, setPulses] = useState([]);
  const [active, setActive] = useState(null);

  const planets = [
    { label: "Kotlin", color: "#22d3ee", pos: [-6, 0.5, -2] },
    { label: "Java", color: "#a78bfa", pos: [6, 0.3, -1] },
    { label: "Dart", color: "#34d399", pos: [-3, -1.4, 1.5] },
    { label: "JavaScript", color: "#f59e0b", pos: [3, -1.6, 1.2] },
    { label: "Python", color: "#fb7185", pos: [0, -2.2, -1] },
  ];

  // refs per planet to attach orbiters when active
  const planetRefs = useMemo(() => Object.fromEntries(planets.map(p => [p.label, React.createRef()])), []);

  const handleActivate = (label, worldPos) => {
    setFilter(label);
    setActive(label);
    setPulses((p) => [...p, { id: Math.random(), pos: worldPos }]);
  };

  return (
    <div className="min-h-screen w-full bg-[#050b0a] text-slate-100">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-emerald-300/20 bg-black/40 backdrop-blur font-mono">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl overflow-hidden ring-1 ring-emerald-300/30">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-white/10" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm md:text-base font-semibold">{user?.name || "Rejwan"} <span className="opacity-60 text-xs">(@{user?.login || GITHUB_USER})</span></div>
            <div className="text-xs opacity-70 line-clamp-1">{user?.bio || "Full Stack Android Developer | Kotlin • Java • Flutter • Dart • Firebase • REST APIs"}</div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noreferrer" className="text-xs md:text-sm underline opacity-90 hover:text-emerald-300">GitHub</a>
            {user?.blog && <a href={user.blog} target="_blank" rel="noreferrer" className="text-xs md:text-sm underline opacity-90 hover:text-emerald-300">Website</a>}
          </div>
        </div>
      </header>

      {/* Hero + 3D Canvas */}
      <section className="relative">
        <div className="absolute inset-0">
          <Canvas camera={{ position: [0, 0, 9], fov: 42 }} shadows>
            <ambientLight intensity={0.6} />
            <directionalLight position={[4, 6, 5]} intensity={1.0} castShadow />
            <CursorLight />
            <ParticleField />
            <Stars radius={80} depth={40} count={5500} factor={4} fade />

            {/* Typewriter intro */}
            <Typewriter3D lines={["> whoami", "Rejwan — Full Stack Android Developer"]} position={[0, 2.2, 0]} />

            <Header3D name={user?.name || "REJWAN"} tagline={(user?.bio || "Full Stack Android Developer").replaceAll("|", "•")} />
            <SpinningKnot position={[0, 0.2, 0]} />
            <GridFloor />

            {planets.map(p => (
              <Planet
                key={p.label}
                ref={planetRefs[p.label]}
                label={p.label}
                color={p.color}
                position={p.pos}
                onActivate={handleActivate}
                active={filter === p.label}
              />
            ))}

            {/* Orbiters for the active planet */}
            <Orbiters targetRef={active ? planetRefs[active] : null} active={!!active} />

            {/* Pulses */}
            {pulses.map((p) => (
              <PulseRing key={p.id} origin={p.pos} onDone={() => setPulses(ps => ps.filter(x => x.id !== p.id))} />
            ))}

            <OrbitControls enablePan={false} minDistance={6} maxDistance={16} />
            <CodeRain />

            <Html position={[0, -3.4, 0]} center wrapperClass="pointer-events-none">
              <div className="text-center text-xs opacity-80 font-mono">
                $ stack filter → <span className="text-emerald-300">{filter}</span>
              </div>
            </Html>
          </Canvas>
        </div>

        <div className="relative z-10 pointer-events-none h-[68vh] md:h-[72vh] w-full bg-gradient-to-b from-transparent via-black/40 to-[#050b0a]" />
      </section>

      {/* Content (UI below) */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 -mt-20">
        <div className="mb-6 flex flex-wrap items-center gap-2 font-mono">
          <StatChip>repos: {user?.public_repos ?? "—"}</StatChip>
          <StatChip>followers: {user?.followers ?? "—"}</StatChip>
          <StatChip>following: {user?.following ?? "—"}</StatChip>
          <StatChip>filter: {filter}</StatChip>
          <div className="ml-auto flex items-center gap-2 pointer-events-auto">
            {user?.blog && (
              <a href={user.blog} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-xl bg-emerald-300 text-black text-xs font-semibold hover:opacity-90">Website</a>
            )}
            <a href={`https://t.me/iamjoker99`} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-xl bg-emerald-300 text-black text-xs font-semibold hover:opacity-90">Telegram</a>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-300/20 bg-black/30 shadow-[0_0_60px_rgba(16,185,129,0.12)]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-300/20 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
              <span className="ml-3 opacity-80">/var/www/portfolio ▶ projects</span>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              {(["All", ...new Set(repos.map(r => r.language).filter(Boolean))].slice(0, 6)).map(l => (
                <button key={l} onClick={() => { setFilter(l); setActive(null); }} className={`px-3 py-1 rounded-full text-xs border font-mono ${filter === l ? "bg-emerald-300 text-black border-emerald-300" : "bg-transparent border-emerald-300/30 hover:bg-emerald-300/10"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 md:p-6">
            {loading && <div className="opacity-80 text-sm font-mono">[loading repositories…]</div>}
            {error && <div className="text-sm text-rose-300 font-mono">{String(error)}</div>}
            {!loading && !error && <RepoList repos={repos} currentFilter={filter} />}
            {!loading && !error && repos.length === 0 && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                {[
                  { name: "TechMirror", url: "https://github.com/iamrejwan/TechMirror", desc: "Web-based forum for tech lovers", lang: "HTML" },
                  { name: "Kashflow-Calculator", url: "https://github.com/iamrejwan/Kashflow-Calculator", desc: "Cash-out charge calculator (Bkash & Nagad)", lang: "Kotlin" },
                  { name: "Chat-U", url: "https://github.com/iamrejwan/Chat-U", desc: "Simple chat app using OpenAI API", lang: "Java" },
                  { name: "DDC-App", url: "https://github.com/iamrejwan/DDC-App", desc: "Digital Data Collector (Android, Kotlin)", lang: "Kotlin" },
                  { name: "ResulteR", url: "https://github.com/iamrejwan/ResulteR", desc: "Flutter app to view results by Student ID", lang: "C++ / Flutter" },
                  { name: "Tape-link-Generator", url: "https://github.com/iamrejwan/Tape-link-Generator", desc: "Direct-link generator for Streamtape", lang: "Python" },
                ].map(f => (
                  <a key={f.name} href={f.url} target="_blank" rel="noreferrer" className="block group">
                    <div className="rounded-xl p-4 border border-emerald-300/20 bg-black/40 hover:bg-black/55 transition shadow-[0_0_40px_rgba(16,185,129,0.08)] font-mono">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm md:text-base font-semibold tracking-tight group-hover:text-emerald-300 transition-colors">{f.name}</h3>
                      </div>
                      <p className="mt-1 text-xs md:text-sm opacity-80 line-clamp-2">{f.desc}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatChip>{f.lang}</StatChip>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-300/20 bg-black/30 shadow-[0_0_60px_rgba(16,185,129,0.12)]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-300/20 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                <span className="ml-3 opacity-80">~ ▶ about</span>
              </div>
            </div>
            <div className="p-4 md:p-6">
              <p className="opacity-90 text-sm leading-relaxed font-mono">
                I am a team player with excellent communication, passionate, and a self‑learned coder. I focus on learning and developing secure, efficient, and scalable Android applications by writing standard, well‑documented, and efficient code. I want to utilize my institutional skills along with my professional skills to implement innovative ideas into reality.
                <br /><br />
                Currently I am working as a freelancer.
              </p>
              <div className="mt-4 flex gap-3">
                <a href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-emerald-300 text-black text-sm font-semibold hover:opacity-90">View GitHub</a>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-black/30 shadow-[0_0_60px_rgba(16,185,129,0.12)]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-300/20 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                <span className="ml-3 opacity-80">/etc/contact</span>
              </div>
            </div>
            <div className="p-4 md:p-6 space-y-2 text-sm font-mono">
              <div className="flex items-center gap-2"><span className="opacity-70 w-28">$ location</span><span>Dhaka, Bangladesh</span></div>
              <div className="flex items-center gap-2"><span className="opacity-70 w-28">$ telegram</span><a className="underline" href="https://t.me/iamjoker99" target="_blank" rel="noreferrer">@iamjoker99</a></div>
              <div className="flex items-center gap-2"><span className="opacity-70 w-28">$ website</span><a className="underline" href="https://iamrejwan.github.io" target="_blank" rel="noreferrer">iamrejwan.github.io</a></div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-emerald-300/20 bg-black/30 shadow-[0_0_60px_rgba(16,185,129,0.12)]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-300/20 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
              <span className="ml-3 opacity-80">~/work ▶ what_i_do</span>
            </div>
            <span className="text-[10px] opacity-60 font-mono">(updated live)</span>
          </div>
          <div className="p-4 md:p-6 grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-300/20 bg-black/30 p-4">
              <h4 className="text-lg font-semibold font-mono">&gt; App Design</h4>
              <p className="mt-2 opacity-80 text-sm leading-relaxed font-mono">
                I like to code things from scratch, and enjoy bringing ideas to life in Android with simple content structure,
                clean design patterns, and thoughtful interactions.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-300/20 bg-black/30 p-4">
              <h4 className="text-lg font-semibold font-mono">&gt; App Development</h4>
              <p className="mt-2 opacity-80 text-sm leading-relaxed font-mono">
                Developing secure, efficient, and scalable Android applications by writing standard, well‑documented, and efficient code.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-emerald-300/20 py-6 text-center text-xs opacity-70 font-mono">
        © {new Date().getFullYear()} Rejwan — Built with React & Three.js
      </footer>
    </div>
  );
}
