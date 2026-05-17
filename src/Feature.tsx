import { useEffect, useMemo, useRef, useState } from "react";
import {
  createClockSync,
  useCamera,
  useExpiringClaim,
  useFairRng,
  useFlashlight,
  useNamedPeer,
  useRotatingTurn,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type PatternKind = "slow" | "fast" | "strobe" | "off";
const PATTERNS: PatternKind[] = ["slow", "fast", "strobe", "off"];
const PERIOD: Record<PatternKind, number> = { slow: 1000, fast: 400, strobe: 120, off: 0 };

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="flash-screen">
        <h1>flash mob</h1>
        <p className="flash-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf } = useNamedPeer(config, room);
  const clock = useMemo(() => createClockSync(room.provider), [room]);
  useFairRng(room, "flash-salts");
  const conductor = useExpiringClaim(room, "conductor", 60_000);
  const rotating = useRotatingTurn(room, clock, { slotMs: 60_000, order: "shuffle" });
  const cam = useCamera({ armed: true, facing: "environment" });
  const torch = useFlashlight(cam.stream);

  const [, rerender] = useState(0);
  useEffect(() => {
    const m = room.doc.getMap<string | number>("pattern");
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room]);

  const patternMap = room.doc.getMap<string | number>("pattern");
  const kind = (patternMap.get("kind") as PatternKind) ?? "off";
  const ts = (patternMap.get("ts") as number) ?? 0;

  const activeConductorId = conductor.claimedBy ?? rotating.currentPeerId;
  const isConductor = activeConductorId === room.peerId;
  const conductorName = activeConductorId
    ? (nameOf(activeConductorId) ?? `peer-${activeConductorId.slice(0, 6)}`)
    : null;

  const [flashOn, setFlashOn] = useState(false);
  const torchRef = useRef(torch);
  torchRef.current = torch;
  useEffect(() => {
    const period = PERIOD[kind];
    if (period <= 0) {
      setFlashOn(false);
      if (torchRef.current.supported) void torchRef.current.setOn(false);
      return;
    }
    let on = true;
    setFlashOn(true);
    if (torchRef.current.supported) void torchRef.current.setOn(true);
    const id = setInterval(() => {
      on = !on;
      setFlashOn(on);
      if (torchRef.current.supported) void torchRef.current.setOn(on);
    }, period);
    return () => {
      clearInterval(id);
      if (torchRef.current.supported) void torchRef.current.setOn(false);
    };
  }, [kind, ts]);

  const setPattern = (k: PatternKind) => {
    patternMap.set("kind", k);
    patternMap.set("bpm", k === "off" ? 0 : Math.round(60000 / PERIOD[k]));
    patternMap.set("ts", Date.now());
  };

  return (
    <div className="flash-screen">
      <header className="flash-header">
        <h1>flash mob</h1>
        <p className="flash-status">
          {room.peerCount + 1} phones · pattern {kind}
        </p>
      </header>

      <div className="flash-name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="your name"
          maxLength={48}
          aria-label="your name"
        />
      </div>

      <div className="flash-conductor">
        {conductorName ? (
          conductor.claimedBy ? (
            <>
              {conductorName} is conducting · {Math.ceil(conductor.msRemaining / 1000)}s left
            </>
          ) : (
            <>{conductorName} is conducting · auto-rotating</>
          )
        ) : (
          "waiting for peers…"
        )}
        {isConductor && <span className="flash-badge">you&apos;re the conductor</span>}
      </div>

      {conductor.isFree && (
        <button
          type="button"
          className="flash-take"
          onClick={conductor.claim}
          aria-label="take the baton"
        >
          take the baton
        </button>
      )}

      {isConductor && (
        <div className="flash-patterns" role="group" aria-label="patterns">
          {PATTERNS.map((p) => (
            <button
              key={p}
              type="button"
              className="flash-pattern"
              data-kind={p}
              data-active={kind === p}
              onClick={() => setPattern(p)}
              aria-label={p}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="flash-current" data-kind={kind}>
        {kind === "off" ? "dark" : `${kind} · ${Math.round(60000 / PERIOD[kind])} bpm`}
      </div>

      <div
        className="flash-surface"
        data-on={flashOn}
        aria-hidden="true"
        style={{ opacity: flashOn ? 1 : 0 }}
      />
    </div>
  );
}
