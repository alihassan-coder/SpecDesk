import {
  CalendarCheck,
  FileStack,
  Lightbulb,
  MessagesSquare,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Static diagram of the real mechanism:
 * idea → question rounds (loop) → 7 agents in parallel → merge into one plan → files + call.
 * Pure inline SVG, themed with currentColor / tokens; wide layout ≥ lg, tall layout below.
 */

const AGENTS = [
  { name: "Analyst", out: "users" },
  { name: "Product", out: "features" },
  { name: "UX", out: "screens" },
  { name: "Architect", out: "stack" },
  { name: "Estimator", out: "price" },
  { name: "Critic", out: "risks" },
  { name: "Researcher", out: "competitors" },
];

function Box({
  x,
  y,
  w,
  h,
  icon: Icon,
  title,
  sub,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  icon: LucideIcon;
  title: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} className={accent ? "fill-card stroke-primary" : "fill-card stroke-border"} strokeWidth={accent ? 1.5 : 1} />
      <Icon x={x + 14} y={y + h / 2 - 9} width={18} height={18} className={accent ? "text-primary" : "text-muted-foreground"} strokeWidth={1.75} />
      <text x={x + 42} y={y + h / 2 - 3} className="fill-foreground" fontSize={13} fontWeight={600}>
        {title}
      </text>
      <text x={x + 42} y={y + h / 2 + 13} className="fill-muted-foreground" fontSize={11}>
        {sub}
      </text>
    </g>
  );
}

function Pill({ x, y, w, name, out }: { x: number; y: number; w: number; name: string; out: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={28} rx={14} className="fill-card stroke-border" />
      <circle cx={x + 14} cy={y + 14} r={3} className="fill-primary" />
      <text x={x + 24} y={y + 18} className="fill-foreground" fontSize={12} fontWeight={500}>
        {name}
      </text>
      <text x={x + w - 12} y={y + 18} textAnchor="end" className="fill-muted-foreground" fontSize={11}>
        {out}
      </text>
    </g>
  );
}

function Label({ x, y, children, anchor = "middle" }: { x: number; y: number; children: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="fill-muted-foreground" fontSize={11}>
      {children}
    </text>
  );
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor" />
      </marker>
    </defs>
  );
}

/* ---------- wide (md and up) ---------- */
function WideDiagram() {
  const W = 1080;
  const H = 340;
  const mid = 170;
  const agentX = 465;
  const agentW = 180;
  const ys = AGENTS.map((_, i) => 36 + i * 40); // pill tops
  const arrow = "url(#sd-arrow-wide)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-muted-foreground/60" role="img" aria-label="Your idea goes through question rounds, then seven agents work in parallel; their results merge into one plan you can export or bring to a call.">
      <Defs id="sd-arrow-wide" />
      <g fill="none" stroke="currentColor" strokeWidth={1.25}>
        {/* idea → questions */}
        <path d={`M170 ${mid} H226`} markerEnd={arrow} />
        {/* question rounds loop */}
        <path d="M265 138 C 265 104, 345 104, 345 134" markerEnd={arrow} />
        {/* fan out */}
        {ys.map((y) => (
          <path key={`o${y}`} d={`M380 ${mid} C 425 ${mid}, 420 ${y + 14}, ${agentX - 4} ${y + 14}`} markerEnd={arrow} />
        ))}
        {/* fan in */}
        {ys.map((y) => (
          <path key={`i${y}`} d={`M${agentX + agentW} ${y + 14} C 690 ${y + 14}, 685 ${mid}, 716 ${mid}`} />
        ))}
        <path d={`M700 ${mid} H716`} markerEnd={arrow} />
        {/* plan → outputs */}
        <path d={`M870 ${mid} C 900 ${mid}, 895 114, 926 114`} markerEnd={arrow} />
        <path d={`M870 ${mid} C 900 ${mid}, 895 226, 926 226`} markerEnd={arrow} />
      </g>

      <Label x={198} y={mid - 10}>brief</Label>
      <Label x={305} y={98}>2–3 rounds</Label>
      <Label x={422} y={24}>your answers</Label>
      <Label x={agentX + agentW / 2} y={24}>7 agents in parallel</Label>
      <Label x={688} y={24}>results</Label>

      <Box x={20} y={mid - 32} w={150} h={64} icon={Lightbulb} title="Your idea" sub="1–2 sentences" />
      <Box x={230} y={mid - 32} w={150} h={64} icon={MessagesSquare} title="Questions" sub="click to answer" />
      {AGENTS.map((a, i) => (
        <Pill key={a.name} x={agentX} y={ys[i]} w={agentW} name={a.name} out={a.out} />
      ))}
      <Box x={720} y={mid - 32} w={150} h={64} icon={ClipboardCheck} title="Your plan" sub="price · weeks" accent />
      <Box x={930} y={86} w={130} h={56} icon={FileStack} title="Files" sub="PDF · MD · CSV" />
      <Box x={930} y={198} w={130} h={56} icon={CalendarCheck} title="Free call" sub="30 minutes" />
    </svg>
  );
}

/* ---------- tall (below md) ---------- */
function TallDiagram() {
  const W = 360;
  const cx = 180;
  const pillTop = 214;
  const ys = AGENTS.map((_, i) => pillTop + i * 36);
  const trunkX = 44;
  const lastMid = ys[ys.length - 1] + 14;
  const planY = lastMid + 52;
  const outY = planY + 56 + 52;
  const H = outY + 60;
  const arrow = "url(#sd-arrow-tall)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-muted-foreground/60" role="img" aria-label="Your idea goes through question rounds, then seven agents work in parallel; their results merge into one plan you can export or bring to a call.">
      <Defs id="sd-arrow-tall" />
      <g fill="none" stroke="currentColor" strokeWidth={1.25}>
        <path d={`M${cx} 66 V96`} markerEnd={arrow} />
        {/* rounds loop on the right of Questions */}
        <path d="M290 112 C 330 112, 330 150, 294 150" markerEnd={arrow} />
        {/* down into trunk */}
        <path d={`M${cx} 156 V176 H${trunkX} V${lastMid}`} />
        {ys.map((y) => (
          <path key={y} d={`M${trunkX} ${y + 14} H${trunkX + 22}`} markerEnd={arrow} />
        ))}
        {/* merge to plan */}
        <path d={`M${W - 44} ${ys[0] + 14} V${lastMid + 22} H${cx} V${planY - 4}`} markerEnd={arrow} />
        {ys.map((y) => (
          <path key={`r${y}`} d={`M${W - 66} ${y + 14} H${W - 44}`} />
        ))}
        {/* outputs */}
        <path d={`M${cx} ${planY + 56} V${planY + 76} H95 V${outY - 4}`} markerEnd={arrow} />
        <path d={`M${cx} ${planY + 76} H265 V${outY - 4}`} markerEnd={arrow} />
      </g>

      <Label x={cx + 8} y={86} anchor="start">brief</Label>
      <Label x={318} y={168}>rounds</Label>
      <Label x={cx} y={pillTop - 12}>7 agents in parallel</Label>

      <Box x={60} y={10} w={240} h={56} icon={Lightbulb} title="Your idea" sub="1–2 sentences" />
      <Box x={60} y={100} w={230} h={56} icon={MessagesSquare} title="Questions" sub="2–3 rounds, click to answer" />
      {AGENTS.map((a, i) => (
        <Pill key={a.name} x={70} y={ys[i]} w={W - 140} name={a.name} out={a.out} />
      ))}
      <Box x={60} y={planY} w={240} h={56} icon={ClipboardCheck} title="Your plan" sub="features · price · weeks" accent />
      <Box x={20} y={outY} w={150} h={56} icon={FileStack} title="Files" sub="PDF · MD · CSV" />
      <Box x={190} y={outY} w={150} h={56} icon={CalendarCheck} title="Free call" sub="30 minutes" />
    </svg>
  );
}

export function PipelineDiagram() {
  return (
    <figure>
      <div className="hidden lg:block">
        <WideDiagram />
      </div>
      <div className="mx-auto max-w-sm lg:hidden">
        <TallDiagram />
      </div>
    </figure>
  );
}
