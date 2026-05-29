import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3force from 'd3-force'
import * as d3zoom from 'd3-zoom'
import * as d3selection from 'd3-selection'
import { X, RefreshCw, Search } from 'lucide-react'
import { useStore } from '../store'
import { cn } from '../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GNode {
  id:    number
  title: string | null
  type:  string
  x?:    number
  y?:    number
  vx?:   number
  vy?:   number
  fx?:   number | null
  fy?:   number | null
}

interface GEdge {
  source: number | GNode
  target: number | GNode
}

// ── Colors ────────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  link:  '#38bdf8',
  note:  '#34d399',
  image: '#a78bfa',
  code:  '#fbbf24',
  quote: '#f472b6',
  file:  '#fb923c'
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GraphViewProps {
  onClose: () => void
}

export function GraphView({ onClose }: GraphViewProps) {
  const { selectedVault, items, selectItem } = useStore()
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const simRef     = useRef<d3force.Simulation<GNode, GEdge> | null>(null)
  const nodesRef   = useRef<GNode[]>([])
  const edgesRef   = useRef<GEdge[]>([])
  const transformRef = useRef<d3zoom.ZoomTransform>(d3zoom.zoomIdentity)
  const rafRef     = useRef<number>(0)
  const [query,    setQuery]    = useState('')
  const [loading,  setLoading]  = useState(true)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const hoveredIdRef = useRef<number | null>(null)

  const getCanvas = () => canvasRef.current

  const draw = useCallback(() => {
    const canvas = getCanvas()
    if (!canvas) return
    const ctx    = canvas.getContext('2d')!
    const t      = transformRef.current
    const nodes  = nodesRef.current
    const edges  = edgesRef.current
    const q      = query.toLowerCase()

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(t.x, t.y)
    ctx.scale(t.k, t.k)

    // Draw edges
    ctx.lineWidth = 1 / t.k
    for (const e of edges) {
      const s = e.source as GNode
      const tg = e.target as GNode
      if (s.x == null || tg.x == null) continue
      ctx.beginPath()
      ctx.moveTo(s.x, s.y!)
      ctx.lineTo(tg.x, tg.y!)
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.stroke()
    }

    // Draw nodes
    for (const n of nodes) {
      if (n.x == null) continue
      const color = TYPE_COLOR[n.type] ?? '#888'
      const isHovered = hoveredIdRef.current === n.id
      const matchQuery = q ? (n.title ?? '').toLowerCase().includes(q) : true
      const r = isHovered ? 8 : 5

      ctx.beginPath()
      ctx.arc(n.x, n.y!, r / t.k, 0, Math.PI * 2)
      ctx.fillStyle = matchQuery ? color : 'rgba(255,255,255,0.1)'
      ctx.fill()
      if (isHovered) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5 / t.k
        ctx.stroke()
      }

      // Label on hover or if matches query
      if (isHovered || (matchQuery && q && t.k > 0.5)) {
        ctx.font = `${11 / t.k}px sans-serif`
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.fillText(
          (n.title ?? `#${n.id}`).slice(0, 30),
          n.x,
          n.y! - (8 / t.k) - (2 / t.k)
        )
      }
    }

    ctx.restore()
  }, [query])

  const startSim = useCallback((nodes: GNode[], edges: GEdge[]) => {
    const canvas = getCanvas()
    if (!canvas) return
    const W = canvas.width
    const H = canvas.height

    simRef.current?.stop()
    simRef.current = d3force.forceSimulation<GNode, GEdge>(nodes)
      .force('link', d3force.forceLink<GNode, GEdge>(edges)
        .id((d) => d.id)
        .distance(80)
        .strength(0.5))
      .force('charge', d3force.forceManyBody<GNode>().strength(-120))
      .force('center',    d3force.forceCenter(W / 2, H / 2))
      .force('collision', d3force.forceCollide<GNode>(14))
      .alphaDecay(0.03)

    simRef.current.on('tick', () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    })
  }, [draw])

  // Load data
  useEffect(() => {
    if (!selectedVault) return
    setLoading(true)
    window.api.items.graphData(selectedVault.id).then(({ nodes, edges }) => {
      const gNodes: GNode[] = nodes.map((n) => ({ ...n }))
      const gEdges: GEdge[] = edges.map((e) => ({
        source: e.source_id,
        target: e.target_id
      }))
      nodesRef.current = gNodes
      edgesRef.current = gEdges
      setNodeCount(gNodes.length)
      setEdgeCount(gEdges.length)
      setLoading(false)
      startSim(gNodes, gEdges)
    }).catch(console.error)
  }, [selectedVault?.id, startSim])

  // Set up zoom
  useEffect(() => {
    const canvas = getCanvas()
    if (!canvas) return

    const zoom = d3zoom.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event: d3zoom.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(draw)
      })

    d3selection.select(canvas).call(zoom)
    return () => { d3selection.select(canvas).on('.zoom', null) }
  }, [draw])

  // Resize
  useEffect(() => {
    const canvas = getCanvas()
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    })
    ro.observe(canvas)
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    return () => ro.disconnect()
  }, [draw])

  // Hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = getCanvas()
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const t = transformRef.current
    const mx = (e.clientX - rect.left - t.x) / t.k
    const my = (e.clientY - rect.top  - t.y) / t.k

    let found: number | null = null
    const threshold = 12 / t.k
    for (const n of nodesRef.current) {
      if (n.x == null) continue
      const dx = n.x - mx
      const dy = (n.y ?? 0) - my
      if (Math.sqrt(dx * dx + dy * dy) < threshold) { found = n.id; break }
    }
    if (found !== hoveredIdRef.current) {
      hoveredIdRef.current = found
      setHoveredId(found)
      canvas.style.cursor = found ? 'pointer' : 'grab'
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(draw)
    }
  }, [draw])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hoveredIdRef.current) return
    const item = useStore.getState().items.find((i) => i.id === hoveredIdRef.current)
    if (item) { selectItem(item); onClose() }
  }, [selectItem, onClose])

  // Redraw when query changes
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
  }, [query, draw])

  // Cleanup
  useEffect(() => {
    return () => {
      simRef.current?.stop()
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text-primary">Knowledge Graph</h2>
          {!loading && (
            <span className="text-[11px] text-text-muted">
              {nodeCount} nodes · {edgeCount} edges
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Filter nodes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-7 pr-2 py-1 text-xs bg-card border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-gold/30 w-44"
            />
          </div>
          {/* Restart simulation */}
          <button
            onClick={() => startSim([...nodesRef.current], [...edgesRef.current])}
            className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-text-primary transition-colors"
            title="Restart layout"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:bg-card hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-2 border-b border-border/50 shrink-0">
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-[11px] text-text-muted capitalize">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {type}
          </div>
        ))}
        <span className="ml-auto text-[11px] text-text-muted">
          Scroll to zoom · Drag to pan · Click node to open
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ cursor: 'grab' }}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
        />
        {/* Hover tooltip */}
        {hoveredId != null && (() => {
          const n = nodesRef.current.find((x) => x.id === hoveredId)
          return n ? (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-text-primary shadow-lg pointer-events-none">
              {n.title ?? `Item #${n.id}`}
              <span className="ml-2 text-text-muted capitalize">{n.type}</span>
            </div>
          ) : null
        })()}
      </div>
    </div>
  )
}
