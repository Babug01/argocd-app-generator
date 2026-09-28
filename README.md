# ArgoCD Application Generator

**Live demo:** https://argocd-app-generator.vercel.app (Vercel) · [GitHub Pages mirror](https://babug01.github.io/argocd-app-generator/)

A form-driven generator for the `argoproj.io/v1alpha1` Application manifest. Fill in the source,
destination, and sync policy you want and get back the exact YAML shape immediately — built for
someone who already knows ArgoCD conceptually but doesn't want to hand-type the indentation for
`syncPolicy.automated` or `source.helm.valueFiles` from memory every time. Nothing you enter ever
leaves your browser.

## Features

- **Source**: Git-path or Helm-chart-repo source, with an inline switch between `path` and `chart`
  and support for extra `helm.valueFiles`
- **Destination**: server + namespace, defaulting to the in-cluster API server
- **Sync policy**: automated sync with prune/selfHeal sub-toggles, plus a checklist for the common
  `syncOptions` (`CreateNamespace=true`, `PrunePropagationPolicy=foreground`, `ApplyOutOfSyncOnly=true`)
- A one-line explanation under every field — what it does and why you'd flip it, not just its name
- Full Application YAML with a copy button, regenerated live as you fill in the form

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — no other runtime dependencies; the
  YAML is hand-assembled from the form state, no YAML library involved

## Running locally

```bash
git clone https://github.com/Babug01/argocd-app-generator.git
cd argocd-app-generator
npm install
npm run dev
```

## License

MIT — see [LICENSE](LICENSE).
