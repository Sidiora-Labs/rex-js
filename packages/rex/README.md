# @sidioralabs/rex

Rex is Sidiora Labs' framework for building web application interfaces that AI agents can write and that AI agents can operate. This package holds the whole framework: the declarations (`entity()`, `action()`, `page()`, `policy()`, `flow()`), the Vite plugin, the Hono and oRPC server, the React client runtime, the checker and the `rex` CLI.

Every action is declared once and is reachable by click, keyboard shortcut, URL and command palette; every page embeds a machine-readable sidecar and carries `data-rex` addresses, so humans and agents operate the same DOM.

## Install

Rex requires Node 22.12 or later. React 19, react-dom, TanStack Query, Vite, zod and TypeScript are peer dependencies.

```sh
npm i @sidioralabs/rex
```

## Start an app

```sh
npx rex new my-app      # writes a complete app into ./my-app with the DesignX UI kit and installs it
cd my-app
npx rex dev             # Vite client and the app's Hono server on one port
npx rex check           # typecheck and convention rules; exit 1 on any error
npx rex build           # dist/client/ and dist/server.js
```

`rex new my-app --ui none` writes the app without DesignX and Tailwind; `--no-install` skips the package manager install.

## Documentation

The source, the full README and the documentation live in the repository at https://github.com/Sidiora-Labs/rex-js:

- the page folder convention: https://github.com/Sidiora-Labs/rex-js/blob/main/docs/convention.md
- the agent contract: https://github.com/Sidiora-Labs/rex-js/blob/main/docs/agent-contract.md
- the primitives: https://github.com/Sidiora-Labs/rex-js/blob/main/docs/primitives.md
- every `rex` command: https://github.com/Sidiora-Labs/rex-js/blob/main/docs/cli.md
- the tutorial: https://github.com/Sidiora-Labs/rex-js/blob/main/docs/tutorial.md
- the API reference: https://github.com/Sidiora-Labs/rex-js/blob/main/docs/api/README.md

Report issues at https://github.com/Sidiora-Labs/rex-js/issues.

## License

MIT, see [LICENSE](LICENSE).
