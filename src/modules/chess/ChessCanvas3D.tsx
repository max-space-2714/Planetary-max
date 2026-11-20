import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type Piece = { square: string; type: string; white: boolean };
export type BoardTheme = 'walnut' | 'green';
const THEMES = {
  walnut: { light: 0xe7d4ad, dark: 0x806042, frame: 0x342417 },
  green: { light: 0xece8d4, dark: 0x68805c, frame: 0x293a2b },
};
const coords = (square: string) => ({ x: square.charCodeAt(0) - 97 - 3.5, z: 3.5 - (Number(square[1]) - 1) });

export default function ChessCanvas3D({ pieces, selected, legal, onSquare, theme = 'walnut' }: {
  pieces: Piece[]; selected: string | null; legal: string[]; onSquare: (square: string) => void; theme?: BoardTheme;
}) {
  const cameraView = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setUnavailable(true); return; }
    setUnavailable(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, el.clientWidth / Math.max(el.clientHeight, 1), .1, 100);
    camera.position.set(9, 12.5, 14);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 10; controls.maxDistance = 28; controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 0, 0);
    if (cameraView.current) { camera.position.copy(cameraView.current.position); controls.target.copy(cameraView.current.target); }
    scene.add(new THREE.HemisphereLight(0xfff5de, 0x4e5b45, 2));
    const light = new THREE.DirectionalLight(0xfff4de, 2.7);
    light.position.set(-5, 14, 8); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -7; light.shadow.camera.right = 7; light.shadow.camera.top = 7; light.shadow.camera.bottom = -7;
    light.shadow.bias = -.0003; scene.add(light);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const geometry = <T extends THREE.BufferGeometry>(g: T) => { geometries.push(g); return g; };
    const material = (color: number, roughness = .6, metalness = 0) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.push(m); return m;
    };
    const palette = THEMES[theme];
    const lightSquare = material(palette.light), darkSquare = material(palette.dark);
    const frame = material(palette.frame, .5), trim = material(0xb99b68, .35, .5);
    const ivory = material(0xf1ead9, .33), ebony = material(0x252a25, .32);
    const marker = material(0xd8bb68, .5), selection = material(0xb9c96a, .55);
    const box = (w: number, h: number, d: number, m: THREE.Material, y: number) => {
      const mesh = new THREE.Mesh(geometry(new THREE.BoxGeometry(w, h, d)), m);
      mesh.position.y = y; mesh.receiveShadow = true; scene.add(mesh); return mesh;
    };
    box(8.8, .27, 8.8, frame, -.2);
    box(8.48, .07, 8.48, trim, -.045);
    const squares: THREE.Mesh[] = [];
    for (let rank = 1; rank <= 8; rank++) for (let file = 0; file < 8; file++) {
      const square = `${String.fromCharCode(97 + file)}${rank}`;
      const c = coords(square);
      const mesh = new THREE.Mesh(geometry(new THREE.BoxGeometry(1, .055, 1)), selected === square ? selection : ((rank + file) % 2 ? darkSquare : lightSquare));
      mesh.position.set(c.x, .02, c.z); mesh.userData.square = square; mesh.receiveShadow = true;
      scene.add(mesh); squares.push(mesh);
      if (legal.includes(square)) {
        const dot = new THREE.Mesh(geometry(new THREE.CylinderGeometry(.11, .11, .012, 24)), marker);
        dot.position.set(c.x, .056, c.z); scene.add(dot);
      }
    }
    // Canvas labels remain readable from either board theme and do not affect hit testing.
    const label = (value: string, x: number, z: number) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.fillStyle = '#e9d3a2'; ctx.font = 'bold 42px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, 32, 32);
      const texture = new THREE.CanvasTexture(canvas); textures.push(texture);
      const labelMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }); materials.push(labelMat);
      const mesh = new THREE.Mesh(geometry(new THREE.PlaneGeometry(.22, .22)), labelMat);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .002, z); scene.add(mesh);
    };
    for (let i = 0; i < 8; i++) { label('abcdefgh'[i], i - 3.5, 4.25); label(String(8 - i), -4.25, i - 3.5); }

    const lathe = (profile: [number, number][]) => geometry(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 32));
    const base = lathe([[0,0],[.32,0],[.36,.04],[.36,.09],[.32,.13],[.27,.15],[.28,.19],[.26,.22],[.22,.23]]);
    const stem = lathe([[.22,.22],[.20,.27],[.15,.57],[.17,.64],[.23,.67],[.23,.72],[.16,.75]]);
    const sphere = (r: number) => geometry(new THREE.SphereGeometry(r, 20, 14));
    const attach = (group: THREE.Group, shape: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(shape, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
    };
    // A cut-out silhouette gives the knight a recognizable head from the playing side.
    const knightShape = new THREE.Shape();
    knightShape.moveTo(-.20, 0); knightShape.lineTo(.20, 0); knightShape.lineTo(.13, .28); knightShape.lineTo(.26, .40);
    knightShape.lineTo(.24, .52); knightShape.lineTo(.06, .59); knightShape.lineTo(-.02, .76); knightShape.lineTo(-.14, .66);
    knightShape.lineTo(-.18, .48); knightShape.lineTo(-.10, .37); knightShape.closePath();
    const knight = geometry(new THREE.ExtrudeGeometry(knightShape, { depth: .18, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 2 }));
    pieces.forEach(piece => {
      const c = coords(piece.square); const group = new THREE.Group(); group.position.set(c.x, .06, c.z);
      const m = piece.white ? ivory : ebony;
      attach(group, base, m);
      if (piece.type === 'n') {
        const head = attach(group, knight, m, 0, .23, -.09);
        head.rotation.y = piece.white ? 0 : Math.PI;
        attach(group, sphere(.025), piece.white ? ebony : ivory, piece.white ? .08 : -.08, .70, piece.white ? .115 : -.115);
      } else {
        const body = attach(group, stem, m);
        if (piece.type === 'p') { body.scale.y = .72; attach(group, sphere(.16), m, 0, .68); }
        if (piece.type === 'r') {
          attach(group, geometry(new THREE.CylinderGeometry(.24, .20, .16, 32)), m, 0, .79);
          for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const battlement = attach(group, geometry(new THREE.BoxGeometry(.095,.12,.10)), m, Math.cos(a)*.18,.92,Math.sin(a)*.18); battlement.rotation.y = -a; }
        }
        if (piece.type === 'b') {
          attach(group, geometry(new THREE.ConeGeometry(.19, .34, 32)), m, 0, .91);
          attach(group, sphere(.06), m, 0, 1.12);
        }
        if (piece.type === 'q' || piece.type === 'k') {
          attach(group, geometry(new THREE.CylinderGeometry(.25,.16,.18,32)), m, 0, .81);
          if (piece.type === 'q') {
            for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; attach(group, sphere(.055), m, Math.cos(a)*.21, .94, Math.sin(a)*.21); }
            attach(group, sphere(.09), m, 0, .98);
          } else {
            attach(group, sphere(.12), m, 0, .98);
            attach(group, geometry(new THREE.BoxGeometry(.065,.25,.065)), m, 0, 1.17);
            attach(group, geometry(new THREE.BoxGeometry(.19,.065,.065)), m, 0, 1.19);
          }
        }
      }
      scene.add(group);
    });
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down = { x: 0, y: 0 };
    const press = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const click = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, camera); const hit = ray.intersectObjects(squares)[0]?.object.userData.square;
      if (hit) onSquare(hit);
    };
    renderer.domElement.addEventListener('pointerdown', press); renderer.domElement.addEventListener('pointerup', click);
    let frameId = 0;
    const render = () => { frameId = requestAnimationFrame(render); controls.update(); renderer.render(scene, camera); }; render();
    const observer = new ResizeObserver(() => { if (!el.clientWidth || !el.clientHeight) return; camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(el.clientWidth, el.clientHeight); });
    observer.observe(el);
    return () => {
      cameraView.current = { position: camera.position.clone(), target: controls.target.clone() };
      cancelAnimationFrame(frameId); observer.disconnect(); renderer.domElement.removeEventListener('pointerdown', press); renderer.domElement.removeEventListener('pointerup', click);
      controls.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.domElement.remove();
    };
  }, [pieces, selected, legal, onSquare, theme]);
  return <div className={`chess-canvas chess-theme-${theme}`} ref={mount} aria-label="Three dimensional chess board">
    {unavailable && <div className="webgl-fallback"><span>3D view unavailable · 2D board</span><div className="fallback-board">{Array.from({length:8},(_,row)=>Array.from({length:8},(_,col)=>{const square=`${'abcdefgh'[col]}${8-row}`;const piece=pieces.find(p=>p.square===square);const symbols:Record<string,string>={wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};return <button key={square} className={`${(row+col)%2?'dark':'light'} ${legal.includes(square)?'legal':''} ${selected===square?'selected':''} ${piece?.white?'white-piece':'black-piece'}`} onClick={()=>onSquare(square)} aria-label={`${square}${piece?` ${piece.white?'white':'black'} ${piece.type}`:''}${legal.includes(square)?' legal move':''}`}>{col===0 && <span className="board-rank" aria-hidden="true">{8-row}</span>}{piece?symbols[`${piece.white?'w':'b'}${piece.type}`]:''}{row===7 && <span className="board-file" aria-hidden="true">{'abcdefgh'[col]}</span>}</button>}))}</div></div>}
    {!unavailable && <div className="canvas-caption">◉ &nbsp; DRAG TO ORBIT &nbsp; / &nbsp; SCROLL TO ZOOM</div>}
  </div>;
}
