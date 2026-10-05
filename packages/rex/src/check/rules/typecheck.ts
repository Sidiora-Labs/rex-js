import { existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { RexApp } from "../engine.ts";
import { defineRule, finding, type Finding } from "../rule.ts";

export const APP_TSCONFIG = "tsconfig.json";

export const DEFAULT_APP_COMPILER_OPTIONS: ts.CompilerOptions = Object.freeze({
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  moduleDetection: ts.ModuleDetectionKind.Force,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noFallthroughCasesInSwitch: true,
  noImplicitOverride: true,
  verbatimModuleSyntax: true,
  isolatedModules: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  allowImportingTsExtensions: true,
  noEmit: true,
  types: [],
});

const HINT = "Fix the type error; rex check type-checks the app with its tsconfig.json.";

interface ProgramInput {
  readonly rootNames: readonly string[];
  readonly options: ts.CompilerOptions;
  readonly configDiagnostics: readonly ts.Diagnostic[];
}

function programInput(app: RexApp): ProgramInput {
  const configPath = path.join(app.root, APP_TSCONFIG);
  if (!existsSync(configPath)) {
    return {
      rootNames: [
        ...app.files.map((file) => file.path),
        ...app.unclassified.map((file) => path.join(app.root, file)),
      ].sort(),
      options: { ...DEFAULT_APP_COMPILER_OPTIONS },
      configDiagnostics: [],
    };
  }
  const read = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file));
  if (read.error) {
    return { rootNames: [], options: {}, configDiagnostics: [read.error] };
  }
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    app.root,
    undefined,
    configPath,
  );
  return {
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
    configDiagnostics: parsed.errors.filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    ),
  };
}

export function diagnosticToFinding(app: RexApp, diagnostic: ts.Diagnostic): Finding | null {
  const severity =
    diagnostic.category === ts.DiagnosticCategory.Error
      ? "error"
      : diagnostic.category === ts.DiagnosticCategory.Warning
        ? "warning"
        : null;
  if (severity === null) return null;
  const message = ts
    .flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");
  let file = existsSync(path.join(app.root, APP_TSCONFIG)) ? APP_TSCONFIG : "app";
  let line = 1;
  let column = 1;
  if (diagnostic.file) {
    file = path.relative(app.root, diagnostic.file.fileName).split(path.sep).join("/");
    if (diagnostic.start !== undefined) {
      const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      line = position.line + 1;
      column = position.character + 1;
    }
  }
  return finding({
    rule: `typecheck/ts${diagnostic.code}`,
    severity,
    file,
    line,
    column,
    message: `TS${diagnostic.code}: ${message}`,
    hint: HINT,
  });
}

export function typecheckApp(app: RexApp): Finding[] {
  const input = programInput(app);
  const diagnostics: ts.Diagnostic[] = [...input.configDiagnostics];
  if (input.configDiagnostics.length === 0) {
    if (input.options.incremental || input.options.composite) {
      const program = ts.createIncrementalProgram({
        rootNames: input.rootNames,
        options: input.options,
      });
      diagnostics.push(
        ...program.getConfigFileParsingDiagnostics(),
        ...program.getOptionsDiagnostics(),
        ...program.getSyntacticDiagnostics(),
        ...program.getGlobalDiagnostics(),
        ...program.getSemanticDiagnostics(),
      );
      if (input.options.declaration || input.options.composite) {
        diagnostics.push(...program.getDeclarationDiagnostics());
      }
      // noEmit preserves only TypeScript's incremental state, never application output.
      diagnostics.push(...program.emit().diagnostics);
    } else {
      const program = ts.createProgram({ rootNames: input.rootNames, options: input.options });
      diagnostics.push(...ts.getPreEmitDiagnostics(program));
    }
  }
  const findings: Finding[] = [];
  for (const diagnostic of ts.sortAndDeduplicateDiagnostics(diagnostics)) {
    const mapped = diagnosticToFinding(app, diagnostic);
    if (mapped) findings.push(mapped);
  }
  return findings;
}

export const typecheckRule = defineRule({
  id: "typecheck",
  description:
    "Runs the TypeScript program over the app with the app tsconfig.json (or the Rex defaults) and reports every diagnostic.",
  check({ app }) {
    return typecheckApp(app);
  },
});
