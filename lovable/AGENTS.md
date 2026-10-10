<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## SiteSignal architecture
- All data flows through `src/lib/api/client.ts`; demo fixtures in `src/lib/demo/` are used when `VITE_API_BASE_URL` is unset — keeps the UI backend-agnostic for later handoff.
- Cinematic 3D lives in `src/components/three/`, driven by the mutable `sceneState` (GSAP writes, R3F reads) — avoids React re-renders per frame.
- 3D labels are DOM nodes positioned by `LabelProjector`, not drei `<Html>` — drei Html caused React 19 root-unmount errors.
- MapLibre is imported dynamically and excluded from Vite optimizeDeps with an explicit worker URL — prebundling breaks its worker.
