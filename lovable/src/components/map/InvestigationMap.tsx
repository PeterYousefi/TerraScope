import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker, GeoJSONSource } from "maplibre-gl";
import { Maximize2, AlertTriangle } from "lucide-react";
import type { Investigation } from "@/types";
import { totalScore } from "@/lib/demo/fixtures";
import { cn } from "@/lib/utils";

const STYLE =
  import.meta.env.VITE_MAP_STYLE_URL ||
  (import.meta.env.VITE_MAPTILER_API_KEY
    ? `https://api.maptiler.com/maps/positron/style.json?key=${encodeURIComponent(import.meta.env.VITE_MAPTILER_API_KEY)}`
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json");

function popupContent(title: string, label: string, detail: string) {
  const el = document.createElement("div");
  for (const text of [title, label, detail]) {
    const line = document.createElement("div");
    line.textContent = text;
    line.style.marginTop = "4px";
    el.appendChild(line);
  }
  return el;
}

/** Resolve a CSS color token into an rgb() string MapLibre can parse. */
function token(name: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d")!;
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#000";
  g.fillRect(0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${gr},${b})`;
}

export interface InvestigationMapProps {
  investigation: Investigation;
  activeLayers: string[];
  showCandidates?: boolean;
  highlightIds?: string[];
  selectedId?: string | null;
  hoverId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  className?: string;
}

export function InvestigationMap({
  investigation,
  activeLayers,
  showCandidates = true,
  highlightIds,
  selectedId,
  hoverId,
  onSelect,
  onHover,
  className,
}: InvestigationMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Map<string, { m: Marker; el: HTMLElement }>>(new Map());
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [coord, setCoord] = useState<[number, number] | null>(null);
  const cb = useRef({ onSelect, onHover });
  cb.current = { onSelect, onHover };

  // init
  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const [ml, worker] = await Promise.all([
        import("maplibre-gl"),
        import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
      ]);
      ml.setWorkerUrl(worker.default);
      if (cancelled || !el.current) return;
      lib.current = ml;
      const m = new ml.Map({
        container: el.current,
        style: STYLE,
        bounds: investigation.area.bounds,
        fitBoundsOptions: { padding: 40 },
        attributionControl: { compact: true },
      });
      map.current = m;
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
      m.on("mousemove", (e) => setCoord([e.lngLat.lng, e.lngLat.lat]));
      m.on("error", () => {
        if (!m.isStyleLoaded()) setStatus("error");
      });
      m.on("load", () => {
        if (!cancelled) {
          m.resize();
          setStatus("ready");
        }
      });
      ro = new ResizeObserver(() => m.resize());
      ro.observe(el.current);
    })().catch(() => setStatus("error"));
    return () => {
      cancelled = true;
      ro?.disconnect();
      markers.current.forEach(({ m }) => m.remove());
      markers.current.clear();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // data layers + candidate markers when investigation changes
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || status !== "ready") return;
    const colors = {
      primary: token("--primary"),
      signal: token("--signal"),
      ink: token("--foreground"),
    };
    // Remove stale layers when switching from previews to saved investigations.
    for (const layer of m.getStyle().layers ?? []) {
      if (
        layer.id.startsWith("layer-") &&
        !investigation.layers.some((l) => `layer-${l.id}` === layer.id)
      ) {
        m.removeLayer(layer.id);
        if (m.getSource(layer.id)) m.removeSource(layer.id);
      }
    }
    const zoneData = {
      type: "FeatureCollection" as const,
      features: showCandidates
        ? investigation.candidates
            .filter((c) => c.geometry)
            .map((c) => ({
              type: "Feature" as const,
              properties: { id: c.id, score: totalScore(c) },
              geometry: c.geometry!,
            }))
        : [],
    };
    const zoneSource = m.getSource("candidate-zones") as GeoJSONSource | undefined;
    if (zoneSource) zoneSource.setData(zoneData as Parameters<GeoJSONSource["setData"]>[0]);
    else {
      m.addSource("candidate-zones", {
        type: "geojson",
        data: zoneData as Parameters<GeoJSONSource["setData"]>[0],
      });
      m.addLayer({
        id: "candidate-zones-fill",
        source: "candidate-zones",
        type: "fill",
        paint: { "fill-color": colors.signal, "fill-opacity": 0.08 },
      });
      m.addLayer({
        id: "candidate-zones-line",
        source: "candidate-zones",
        type: "line",
        paint: { "line-color": colors.signal, "line-width": 1 },
      });
      m.on("click", "candidate-zones-fill", (e) => {
        const id = e.features?.[0]?.properties?.["id"];
        if (typeof id === "string") cb.current.onSelect?.(id);
      });
    }
    investigation.layers.forEach((l) => {
      const id = `layer-${l.id}`;
      const data = {
        type: "FeatureCollection" as const,
        features: l.points.map((p) => ({
          type: "Feature" as const,
          properties: { label: p.label, value: p.value ?? 0 },
          geometry: { type: "Point" as const, coordinates: p.coords },
        })),
      };
      const src = m.getSource(id) as GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        m.addSource(id, { type: "geojson", data });
        const c = colors[l.color];
        if (l.kind === "demand") {
          m.addLayer({
            id,
            type: "circle",
            source: id,
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                9,
                ["/", ["get", "value"], 3],
                14,
                ["*", ["get", "value"], 1.4],
              ],
              "circle-color": c,
              "circle-opacity": 0.14,
              "circle-stroke-color": c,
              "circle-stroke-width": 1,
              "circle-stroke-opacity": 0.5,
              "circle-opacity-transition": { duration: 400 },
            },
          });
        } else if (l.kind === "gap") {
          m.addLayer({
            id,
            type: "circle",
            source: id,
            paint: {
              "circle-radius": 22,
              "circle-color": c,
              "circle-opacity": 0.12,
              "circle-stroke-color": c,
              "circle-stroke-width": 1.5,
            },
          });
        } else {
          m.addLayer({
            id,
            type: "circle",
            source: id,
            paint: {
              "circle-radius": 5,
              "circle-color": c,
              "circle-stroke-color": "rgb(255,255,255)",
              "circle-stroke-width": 1.5,
            },
          });
        }
        m.on("click", id, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          new ml.Popup({ offset: 8, closeButton: false })
            .setLngLat(e.lngLat)
            .setDOMContent(
              popupContent(
                l.label,
                String(f.properties?.["label"] ?? ""),
                investigation.isDemo
                  ? "Illustrative demo value"
                  : "Retrieved source / calculated proxy",
              ),
            )
            .addTo(m);
        });
        m.on("mouseenter", id, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", id, () => (m.getCanvas().style.cursor = ""));
      }
    });

    markers.current.forEach(({ m: mk }) => mk.remove());
    markers.current.clear();
    if (showCandidates) {
      investigation.candidates.forEach((c) => {
        const node = document.createElement("button");
        node.type = "button";
        node.setAttribute("aria-label", `Candidate ${c.rank}: ${c.name}`);
        node.className =
          "grid size-8 place-items-center rounded-full border-2 border-paper bg-signal font-mono text-xs font-semibold text-signal-foreground shadow-md transition-transform";
        node.textContent = String(c.rank);
        node.onclick = (ev) => {
          ev.stopPropagation();
          cb.current.onSelect?.(c.id);
        };
        node.onmouseenter = () => cb.current.onHover?.(c.id);
        node.onmouseleave = () => cb.current.onHover?.(null);
        const popup = new ml.Popup({ offset: 18, closeButton: false }).setDOMContent(
          popupContent(
            `Opportunity area ${c.rank}`,
            c.name,
            `Score ${totalScore(c)} (${investigation.isDemo ? "illustrative" : "calculated screening proxy"})`,
          ),
        );
        const mk = new ml.Marker({ element: node }).setLngLat(c.coords).setPopup(popup).addTo(m);
        markers.current.set(c.id, { m: mk, el: node });
      });
    }
    m.fitBounds(investigation.area.bounds, { padding: 40, duration: 900 });
  }, [investigation, status, showCandidates]);

  // layer visibility
  useEffect(() => {
    const m = map.current;
    if (!m || status !== "ready") return;
    investigation.layers.forEach((l) => {
      const id = `layer-${l.id}`;
      if (m.getLayer(id))
        m.setLayoutProperty(id, "visibility", activeLayers.includes(l.id) ? "visible" : "none");
    });
  }, [activeLayers, investigation, status]);

  // selection / hover / highlight
  useEffect(() => {
    markers.current.forEach(({ el: node }, id) => {
      const on = id === hoverId || id === selectedId;
      const dim = highlightIds && !highlightIds.includes(id);
      node.style.transform = on ? "scale(1.25)" : "scale(1)";
      node.style.opacity = dim ? "0.35" : "1";
      node.style.zIndex = on ? "2" : "1";
    });
  }, [hoverId, selectedId, highlightIds]);

  useEffect(() => {
    const m = map.current;
    if (!m || !selectedId) return;
    const c = investigation.candidates.find((x) => x.id === selectedId);
    if (!c) return;
    m.flyTo({ center: c.coords, zoom: 13, speed: 1.1, curve: 1.4, essential: true });
    const mk = markers.current.get(selectedId)?.m;
    if (mk && !mk.getPopup()?.isOpen()) mk.togglePopup();
  }, [selectedId, investigation]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-muted", className)}>
      <div ref={el} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-muted">
          <div className="label-tech animate-pulse text-muted-foreground">Loading basemap…</div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-muted p-6 text-center">
          <div>
            <AlertTriangle className="mx-auto mb-2 size-5 text-signal" />
            <div className="text-sm">The basemap could not load.</div>
            <div className="label-tech mt-1 text-muted-foreground">
              Check your connection — results remain available in the panel.
            </div>
          </div>
        </div>
      )}
      {status === "ready" && (
        <>
          <button
            type="button"
            onClick={() =>
              map.current?.fitBounds(investigation.area.bounds, { padding: 40, duration: 900 })
            }
            className="label-tech absolute left-3 top-3 flex items-center gap-2 border border-border bg-paper px-2.5 py-1.5 hover:bg-muted"
          >
            <Maximize2 className="size-3" /> Fit area
          </button>
          <div className="absolute bottom-8 right-3 border border-border bg-paper/95 p-3">
            <div className="label-tech mb-2 text-muted-foreground">
              Legend · {investigation.isDemo ? "demo" : "real data / proxies"}
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-foreground" /> Existing supply
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full border border-primary bg-primary/20" />{" "}
                Demand signal
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full border border-signal bg-signal/20" />{" "}
                Coverage gap
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-signal" /> Candidate
              </li>
            </ul>
          </div>
          {coord && (
            <div className="label-tech pointer-events-none absolute right-14 top-3 bg-paper/90 px-2 py-1 text-muted-foreground">
              {coord[1].toFixed(4)}° {coord[1] >= 0 ? "N" : "S"} / {Math.abs(coord[0]).toFixed(4)}°{" "}
              {coord[0] >= 0 ? "E" : "W"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
