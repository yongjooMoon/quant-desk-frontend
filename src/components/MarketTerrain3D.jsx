import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';

// [2026-09-16] 대대적 리디자인용 시그니처 3D 요소.
// "장식용 3D 오브젝트"가 아니라 이 프로젝트의 주제(퀀트 데이터)를 그대로 형상화한
// 것 — 중심에서 퍼져나가는 사인파로 높이가 출렁이는 격자를 "실시간 시장 데이터
// 지형"처럼 보이게 한다. 순수 장식(예: 떠다니는 구체)보다 주제와 직결되도록 설계.
const COLS = 26;
const ROWS = 11;
const SPACING = 0.34;
const BASE_HEX = '#1a2030';
const PEAK_HEX = '#E3A24A';

function Terrain() {
  const ref = useRef();
  const baseColor = useMemo(() => new THREE.Color(BASE_HEX), []);
  const peakColor = useMemo(() => new THREE.Color(PEAK_HEX), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const positions = useMemo(() => {
    const out = [];
    for (let x = 0; x < COLS; x++) {
      for (let z = 0; z < ROWS; z++) {
        const px = (x - (COLS - 1) / 2) * SPACING;
        const pz = (z - (ROWS - 1) / 2) * SPACING;
        out.push({ px, pz, dist: Math.hypot(px, pz) });
      }
    }
    return out;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    positions.forEach((p, i) => {
      const wave = Math.sin(p.dist * 1.35 - t * 1.1) * 0.5 + 0.5;
      const h = 0.12 + wave * 1.55;
      const obj = ref.current.children[i];
      if (!obj) return;
      obj.scale.set(1, h, 1);
      obj.position.set(p.px, h / 2 - 0.55, p.pz);
      tmpColor.copy(baseColor).lerp(peakColor, wave);
      obj.color.set(tmpColor);
    });
  });

  return (
    <Instances ref={ref} limit={COLS * ROWS}>
      <boxGeometry args={[0.22, 1, 0.22]} />
      <meshStandardMaterial roughness={0.5} metalness={0.15} />
      {positions.map((p, i) => (
        <Instance key={i} position={[p.px, 0, p.pz]} color={BASE_HEX} />
      ))}
    </Instances>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// 모바일에서는 아예 마운트하지 않는다 — 순수 장식 요소에 배터리/성능을 쓰지 않기 위함.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function MarketTerrain3D({ className = '' }) {
  const isDesktop = useIsDesktop();
  const reducedMotion = useReducedMotion();

  if (!isDesktop) return null;

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 4.4, 7.6], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        frameloop={reducedMotion ? 'demand' : 'always'}
      >
        <fog attach="fog" args={['#0a0d13', 6, 13]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 2]} intensity={1.1} color="#fff3e0" />
        <Terrain />
      </Canvas>
    </div>
  );
}
