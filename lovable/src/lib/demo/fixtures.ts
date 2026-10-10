import type { AgentExecutionStep, Investigation, MapLayer } from "@/types";

/**
 * DEMO FIXTURES — every value in this file is illustrative.
 * Scores, counts and claims are NOT verified findings. Source entries point to
 * real public publishers as *intended* inputs; none are fetched in demo mode.
 */

const steps = (topic: string, area: string): AgentExecutionStep[] => [
  { id: "parse", agent: "Planning agent", label: "Parse the geographic question", detail: `Intent: ${topic}. Output: ranked site candidates.`, durationMs: 700 },
  { id: "resolve", agent: "Planning agent", label: "Resolve the area of interest", detail: `${area} — city boundary resolved to bounding box.`, durationMs: 600 },
  { id: "sources", agent: "Data discovery agent", label: "Identify required data sources", detail: "Selected 4 sample source references for this question type.", durationMs: 800 },
  { id: "collect", agent: "Data discovery agent", label: "Collect available geographic signals", detail: "Loaded demo layers: existing supply, demand proxies, corridors.", durationMs: 1100 },
  { id: "generate", agent: "Geospatial analysis agent", label: "Generate candidate zones", detail: "Gap analysis between demand density and existing coverage.", durationMs: 900 },
  { id: "evaluate", agent: "Evaluation agent", label: "Evaluate and compare candidates", detail: "Weighted multi-criteria scoring across 4 dimensions.", durationMs: 900 },
  { id: "report", agent: "Report synthesis agent", label: "Produce an evidence-backed report", detail: "Linked each claim to its source reference.", durationMs: 700 },
];

const austinLayers: MapLayer[] = [
  { id: "existing", label: "Existing charging stations", kind: "existing", color: "ink", points: [
    { coords: [-97.7431, 30.2672], label: "Downtown garage (sample)" },
    { coords: [-97.7394, 30.2849], label: "UT campus (sample)" },
    { coords: [-97.7536, 30.2500], label: "South Congress (sample)" },
    { coords: [-97.7210, 30.2950], label: "Mueller (sample)" },
    { coords: [-97.6890, 30.3870], label: "Domain area (sample)" },
    { coords: [-97.7700, 30.2300], label: "Zilker (sample)" },
  ]},
  { id: "demand", label: "Activity density", kind: "demand", color: "primary", points: [
    { coords: [-97.6990, 30.4020], label: "North Burnet", value: 82 },
    { coords: [-97.6640, 30.3200], label: "Windsor Park", value: 64 },
    { coords: [-97.7930, 30.2030], label: "South Lamar / Ben White", value: 77 },
    { coords: [-97.7200, 30.2600], label: "East Cesar Chavez", value: 71 },
    { coords: [-97.8300, 30.4450], label: "Four Points", value: 58 },
  ]},
  { id: "gap", label: "Coverage gaps", kind: "gap", color: "signal", points: [
    { coords: [-97.6720, 30.3510], label: "US-183 corridor" },
    { coords: [-97.7900, 30.1950], label: "Ben White & Lamar" },
  ]},
];

export const investigations: [Investigation, Investigation, Investigation] = [
  {
    id: "austin-ev",
    title: "EV charging opportunity — Austin",
    question: { text: "Where should I open a new EV charging station in Austin?", type: "ev-charging" },
    area: { name: "Austin", region: "Texas, USA", center: [-97.7431, 30.2672], bounds: [[-97.88, 30.15], [-97.62, 30.47]], zoom: 11 },
    status: "complete",
    createdAt: "2026-10-02T14:20:00Z",
    isDemo: true,
    steps: steps("site selection for EV charging", "Austin, TX"),
    layers: austinLayers,
    sources: [
      { id: "afdc", name: "Alternative Fuel Stations", publisher: "U.S. DOE — AFDC", url: "https://afdc.energy.gov/stations", kind: "api", status: "sample", freshness: "Not fetched (demo)" },
      { id: "acs", name: "American Community Survey 5-yr", publisher: "U.S. Census Bureau", url: "https://www.census.gov/programs-surveys/acs", kind: "public-dataset", status: "sample", freshness: "Not fetched (demo)" },
      { id: "osm", name: "Road network & POIs", publisher: "OpenStreetMap contributors", url: "https://www.openstreetmap.org", kind: "public-dataset", status: "sample", freshness: "Not fetched (demo)" },
      { id: "txdot", name: "Traffic counts (AADT)", publisher: "TxDOT", url: "https://www.txdot.gov/data-maps.html", kind: "public-dataset", status: "sample", freshness: "Not fetched (demo)" },
    ],
    evidence: [
      { id: "e1", sourceId: "afdc", claim: "Illustrative: no public DC fast charger within ~2 km of the US-183 / Burnet junction.", candidateIds: ["a1"] },
      { id: "e2", sourceId: "txdot", claim: "Illustrative: corridor carries high daily through-traffic suitable for 20–40 min stops.", candidateIds: ["a1", "a3"] },
      { id: "e3", sourceId: "acs", claim: "Illustrative: high share of multi-unit housing, implying limited at-home charging.", candidateIds: ["a2", "a3"] },
      { id: "e4", sourceId: "osm", claim: "Illustrative: grocery and retail POIs cluster within walking distance.", candidateIds: ["a2", "a4"] },
      { id: "e5", sourceId: "afdc", claim: "Illustrative: existing chargers concentrate downtown, leaving the south arterial underserved.", candidateIds: ["a2"] },
    ],
    candidates: [
      { id: "a1", rank: 1, name: "North Burnet / US-183", neighborhood: "North Burnet", coords: [-97.6990, 30.4000],
        scores: [{ dimension: "Demand", value: 86, weight: 0.35 }, { dimension: "Coverage gap", value: 91, weight: 0.3 }, { dimension: "Accessibility", value: 82, weight: 0.2 }, { dimension: "Site feasibility", value: 68, weight: 0.15 }],
        rationale: "Strong demand proxy and the widest illustrative coverage gap, directly on a high-traffic corridor.",
        strengths: ["Corridor through-traffic", "Dense employment nearby", "Largest gap in demo coverage layer"], weaknesses: ["Land cost likely high", "Grid capacity unverified"], uncertainty: "medium", evidenceIds: ["e1", "e2"] },
      { id: "a2", rank: 2, name: "South Lamar & Ben White", neighborhood: "South Lamar", coords: [-97.7910, 30.2040],
        scores: [{ dimension: "Demand", value: 80, weight: 0.35 }, { dimension: "Coverage gap", value: 78, weight: 0.3 }, { dimension: "Accessibility", value: 85, weight: 0.2 }, { dimension: "Site feasibility", value: 72, weight: 0.15 }],
        rationale: "Mixed residential density with retail anchors and few nearby fast chargers in the sample layer.",
        strengths: ["Retail anchors for dwell time", "Multi-unit housing"], weaknesses: ["Congestion at peak hours"], uncertainty: "medium", evidenceIds: ["e3", "e4", "e5"] },
      { id: "a3", rank: 3, name: "Windsor Park / US-290", neighborhood: "Windsor Park", coords: [-97.6660, 30.3190],
        scores: [{ dimension: "Demand", value: 66, weight: 0.35 }, { dimension: "Coverage gap", value: 84, weight: 0.3 }, { dimension: "Accessibility", value: 74, weight: 0.2 }, { dimension: "Site feasibility", value: 80, weight: 0.15 }],
        rationale: "Moderate demand but clear gap and comparatively feasible parcels.",
        strengths: ["Feasible parcels", "Growing residential base"], weaknesses: ["Lower current EV adoption (unverified)"], uncertainty: "high", evidenceIds: ["e2", "e3"] },
      { id: "a4", rank: 4, name: "East Cesar Chavez", neighborhood: "East Austin", coords: [-97.7210, 30.2590],
        scores: [{ dimension: "Demand", value: 74, weight: 0.35 }, { dimension: "Coverage gap", value: 55, weight: 0.3 }, { dimension: "Accessibility", value: 79, weight: 0.2 }, { dimension: "Site feasibility", value: 61, weight: 0.15 }],
        rationale: "Active district close to downtown, but partially served by existing chargers.",
        strengths: ["Nightlife & dining dwell time"], weaknesses: ["Partial existing coverage", "Limited parking"], uncertainty: "low", evidenceIds: ["e4"] },
    ],
    report: {
      summary: "In this illustrative run, the strongest opportunity is along the US-183 corridor in North Burnet, where a large demand proxy overlaps the widest gap in the sample charging layer.",
      findings: [
        "Sample charging supply clusters in the downtown core and campus.",
        "Northern corridor and south arterial show demand without nearby fast charging.",
        "Accessibility is broadly strong; site feasibility is the main differentiator.",
      ],
      limitations: [
        "All layers are demo fixtures — no live AFDC, Census or TxDOT data was fetched.",
        "Grid capacity and parcel availability are not modeled.",
        "Scores are illustrative weights, not calibrated predictions.",
      ],
      rankingExplanation: "Weighted sum: Demand 35%, Coverage gap 30%, Accessibility 20%, Site feasibility 15%.",
    },
  },
  {
    id: "seattle-coffee",
    title: "Coffee shop opportunity — Seattle",
    question: { text: "Which Seattle neighborhoods might be promising for a new coffee shop?", type: "retail" },
    area: { name: "Seattle", region: "Washington, USA", center: [-122.3321, 47.6062], bounds: [[-122.44, 47.5], [-122.24, 47.73]], zoom: 11 },
    status: "complete",
    createdAt: "2026-09-28T09:05:00Z",
    isDemo: true,
    steps: steps("retail site selection for a coffee shop", "Seattle, WA"),
    layers: [
      { id: "existing", label: "Existing cafés (sample)", kind: "existing", color: "ink", points: [
        { coords: [-122.3400, 47.6100], label: "Pike Place (sample)" }, { coords: [-122.3200, 47.6150], label: "Capitol Hill (sample)" },
        { coords: [-122.3550, 47.6500], label: "Fremont (sample)" }, { coords: [-122.3130, 47.6600], label: "U District (sample)" },
      ]},
      { id: "demand", label: "Foot-traffic proxy", kind: "demand", color: "primary", points: [
        { coords: [-122.3870, 47.6690], label: "Ballard", value: 78 }, { coords: [-122.3010, 47.5480], label: "Beacon Hill", value: 62 },
        { coords: [-122.3860, 47.5630], label: "West Seattle Junction", value: 70 },
      ]},
      { id: "gap", label: "Underserved blocks", kind: "gap", color: "signal", points: [
        { coords: [-122.2930, 47.5600], label: "North Beacon Hill" }, { coords: [-122.3200, 47.6900], label: "Roosevelt" },
      ]},
    ],
    sources: [
      { id: "osm", name: "Café POIs", publisher: "OpenStreetMap contributors", url: "https://www.openstreetmap.org", kind: "public-dataset", status: "sample", freshness: "Not fetched (demo)" },
      { id: "acs", name: "American Community Survey 5-yr", publisher: "U.S. Census Bureau", url: "https://www.census.gov/programs-surveys/acs", kind: "public-dataset", status: "sample", freshness: "Not fetched (demo)" },
      { id: "sdot", name: "Pedestrian counts", publisher: "Seattle DOT", url: "https://data.seattle.gov", kind: "public-dataset", status: "sample", freshness: "Not fetched (demo)" },
    ],
    evidence: [
      { id: "e1", sourceId: "osm", claim: "Illustrative: fewer independent cafés per capita than adjacent neighborhoods.", candidateIds: ["s1", "s3"] },
      { id: "e2", sourceId: "sdot", claim: "Illustrative: steady weekday pedestrian flow near light-rail station.", candidateIds: ["s1", "s2"] },
      { id: "e3", sourceId: "acs", claim: "Illustrative: growing 25–39 age cohort.", candidateIds: ["s2"] },
    ],
    candidates: [
      { id: "s1", rank: 1, name: "North Beacon Hill station", neighborhood: "Beacon Hill", coords: [-122.3120, 47.5680],
        scores: [{ dimension: "Foot traffic", value: 79, weight: 0.35 }, { dimension: "Competition gap", value: 88, weight: 0.3 }, { dimension: "Demographics", value: 72, weight: 0.2 }, { dimension: "Rent feasibility", value: 75, weight: 0.15 }],
        rationale: "Transit foot traffic with comparatively few cafés in the sample POI layer.", strengths: ["Light-rail station", "Low competition"], weaknesses: ["Hilly approach"], uncertainty: "medium", evidenceIds: ["e1", "e2"] },
      { id: "s2", rank: 2, name: "Roosevelt", neighborhood: "Roosevelt", coords: [-122.3170, 47.6760],
        scores: [{ dimension: "Foot traffic", value: 82, weight: 0.35 }, { dimension: "Competition gap", value: 64, weight: 0.3 }, { dimension: "Demographics", value: 84, weight: 0.2 }, { dimension: "Rent feasibility", value: 60, weight: 0.15 }],
        rationale: "New transit-oriented housing with strong demographic fit.", strengths: ["New housing", "Station access"], weaknesses: ["Rising rents"], uncertainty: "low", evidenceIds: ["e2", "e3"] },
      { id: "s3", rank: 3, name: "West Seattle Junction", neighborhood: "West Seattle", coords: [-122.3870, 47.5610],
        scores: [{ dimension: "Foot traffic", value: 70, weight: 0.35 }, { dimension: "Competition gap", value: 70, weight: 0.3 }, { dimension: "Demographics", value: 68, weight: 0.2 }, { dimension: "Rent feasibility", value: 78, weight: 0.15 }],
        rationale: "Walkable main street with moderate competition.", strengths: ["Walkable retail strip"], weaknesses: ["Bridge-dependent access"], uncertainty: "high", evidenceIds: ["e1"] },
    ],
    report: {
      summary: "Illustratively, North Beacon Hill pairs transit foot traffic with a thin café supply in the sample layer.",
      findings: ["Sample café supply concentrates downtown and in Capitol Hill.", "Transit stations outside the core show a competition gap."],
      limitations: ["Demo fixtures only.", "Lease availability not modeled.", "Scores are illustrative."],
      rankingExplanation: "Weighted sum: Foot traffic 35%, Competition gap 30%, Demographics 20%, Rent feasibility 15%.",
    },
  },
  {
    id: "chicago-bike",
    title: "Bike-share accessibility — Chicago",
    question: { text: "Where could Chicago benefit from additional bike-share stations?", type: "mobility" },
    area: { name: "Chicago", region: "Illinois, USA", center: [-87.6298, 41.8781], bounds: [[-87.85, 41.7], [-87.52, 42.02]], zoom: 10.5 },
    status: "complete",
    createdAt: "2026-09-21T17:40:00Z",
    isDemo: true,
    steps: steps("mobility access gap analysis", "Chicago, IL"),
    layers: [
      { id: "existing", label: "Existing docks (sample)", kind: "existing", color: "ink", points: [
        { coords: [-87.6290, 41.8820], label: "Loop (sample)" }, { coords: [-87.6430, 41.9210], label: "Lincoln Park (sample)" },
        { coords: [-87.6680, 41.9080], label: "Wicker Park (sample)" }, { coords: [-87.6000, 41.7900], label: "Hyde Park (sample)" },
      ]},
      { id: "demand", label: "Transit-access need", kind: "demand", color: "primary", points: [
        { coords: [-87.6900, 41.7800], label: "Chicago Lawn", value: 81 }, { coords: [-87.7250, 41.8800], label: "West Garfield Park", value: 77 },
        { coords: [-87.6550, 41.7500], label: "Auburn Gresham", value: 74 },
      ]},
      { id: "gap", label: "Dock deserts", kind: "gap", color: "signal", points: [
        { coords: [-87.7200, 41.8650], label: "North Lawndale" }, { coords: [-87.6600, 41.7550], label: "Auburn Gresham" },
      ]},
    ],
    sources: [
      { id: "divvy", name: "Divvy station feed (GBFS)", publisher: "Lyft / City of Chicago", url: "https://divvybikes.com/system-data", kind: "api", status: "sample", freshness: "Not fetched (demo)" },
      { id: "cta", name: "CTA stops", publisher: "Chicago Transit Authority", url: "https://www.transitchicago.com/data/", kind: "public-dataset", status: "sample", freshness: "Not fetched (demo)" },
      { id: "acs", name: "American Community Survey 5-yr", publisher: "U.S. Census Bureau", url: "https://www.census.gov/programs-surveys/acs", kind: "public-dataset", status: "sample", freshness: "Not fetched (demo)" },
    ],
    evidence: [
      { id: "e1", sourceId: "divvy", claim: "Illustrative: dock spacing exceeds 800 m across several blocks.", candidateIds: ["c1", "c2"] },
      { id: "e2", sourceId: "cta", claim: "Illustrative: L stations lack a first/last-mile dock within 400 m.", candidateIds: ["c1", "c3"] },
      { id: "e3", sourceId: "acs", claim: "Illustrative: lower household vehicle access.", candidateIds: ["c2", "c3"] },
    ],
    candidates: [
      { id: "c1", rank: 1, name: "North Lawndale / Pink Line", neighborhood: "North Lawndale", coords: [-87.7190, 41.8540],
        scores: [{ dimension: "Access need", value: 88, weight: 0.35 }, { dimension: "Dock gap", value: 90, weight: 0.3 }, { dimension: "Transit link", value: 80, weight: 0.2 }, { dimension: "Street feasibility", value: 70, weight: 0.15 }],
        rationale: "Large dock gap next to rail stations with high access need.", strengths: ["Pink Line connection", "Equity impact"], weaknesses: ["Ridership baseline unknown"], uncertainty: "medium", evidenceIds: ["e1", "e2"] },
      { id: "c2", rank: 2, name: "Auburn Gresham / 79th St", neighborhood: "Auburn Gresham", coords: [-87.6530, 41.7510],
        scores: [{ dimension: "Access need", value: 84, weight: 0.35 }, { dimension: "Dock gap", value: 86, weight: 0.3 }, { dimension: "Transit link", value: 66, weight: 0.2 }, { dimension: "Street feasibility", value: 74, weight: 0.15 }],
        rationale: "Busy 79th St bus corridor with sparse sample dock coverage.", strengths: ["Bus corridor"], weaknesses: ["Farther from rail"], uncertainty: "medium", evidenceIds: ["e1", "e3"] },
      { id: "c3", rank: 3, name: "West Garfield Park / Green Line", neighborhood: "West Garfield Park", coords: [-87.7260, 41.8810],
        scores: [{ dimension: "Access need", value: 80, weight: 0.35 }, { dimension: "Dock gap", value: 72, weight: 0.3 }, { dimension: "Transit link", value: 84, weight: 0.2 }, { dimension: "Street feasibility", value: 66, weight: 0.15 }],
        rationale: "Green Line access with some existing coverage nearby.", strengths: ["Green Line"], weaknesses: ["Partial coverage"], uncertainty: "low", evidenceIds: ["e2", "e3"] },
    ],
    report: {
      summary: "Illustratively, West Side and South Side rail corridors show the largest dock gaps relative to access need.",
      findings: ["Sample docks concentrate north of the Loop.", "Rail stations on the West Side lack first/last-mile docks."],
      limitations: ["Demo fixtures only — no GBFS feed fetched.", "Ridership demand not modeled.", "Scores are illustrative."],
      rankingExplanation: "Weighted sum: Access need 35%, Dock gap 30%, Transit link 20%, Street feasibility 15%.",
    },
  },
];

export const totalScore = (c: { scores: { value: number; weight: number }[] }) =>
  Math.round(c.scores.reduce((s, d) => s + d.value * d.weight, 0));

export const getDemoInvestigation = (id: string) => investigations.find((i) => i.id === id);

export const matchQuestion = (q: string): Investigation => {
  const t = q.toLowerCase();
  if (t.includes("seattle") || t.includes("coffee") || t.includes("café") || t.includes("cafe")) return investigations[1];
  if (t.includes("chicago") || t.includes("bike")) return investigations[2];
  return investigations[0];
};
