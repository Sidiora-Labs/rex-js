const NAME_PATTERN = /^[a-z][a-z0-9.-]*$/;
const COMPONENT_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

export class RexNameError extends Error {
  readonly kind: string;
  readonly value: unknown;

  constructor(kind: string, value: unknown, rule: string) {
    super(`invalid ${kind} ${JSON.stringify(value)}: ${rule}`);
    this.name = "RexNameError";
    this.kind = kind;
    this.value = value;
  }
}

export function isValidName(name: unknown): name is string {
  return typeof name === "string" && NAME_PATTERN.test(name);
}

export function validateName<N extends string>(name: N, kind = "name"): N {
  if (typeof name !== "string" || name.length === 0) {
    throw new RexNameError(kind, name, "must be a non-empty string");
  }
  if (/^[0-9]/.test(name)) {
    throw new RexNameError(kind, name, "must not start with a digit");
  }
  if (!NAME_PATTERN.test(name)) {
    throw new RexNameError(
      kind,
      name,
      "must start with a lowercase letter and contain only lowercase letters, digits, dot and dash",
    );
  }
  return name;
}

export function validateComponentName<N extends string>(name: N, kind = "component name"): N {
  if (typeof name !== "string" || !COMPONENT_PATTERN.test(name)) {
    throw new RexNameError(
      kind,
      name,
      "must be PascalCase: an uppercase letter followed by letters and digits",
    );
  }
  return name;
}

export function pageId<N extends string>(name: N): N {
  return validateName(name, "page id");
}

export function actionId<N extends string>(name: N): N {
  return validateName(name, "action id");
}

export function regionName<N extends string>(name: N): N {
  return validateName(name, "region name");
}

export function overlayName<N extends string>(name: N): N {
  return validateComponentName(name, "overlay name");
}

export type PageAddress<P extends string> = P;
export type ActionAddress<P extends string, A extends string> = `${P}/${A}`;
export type RegionAddress<P extends string, R extends string> = `${P}/${R}`;
export type OverlayAddress<P extends string, O extends string> = `${P}/${O}`;

export function pageAddress<P extends string>(page: P): PageAddress<P> {
  return pageId(page);
}

export function actionAddress<P extends string, A extends string>(
  page: P,
  action: A,
): ActionAddress<P, A> {
  return `${pageId(page)}/${actionId(action)}`;
}

export function regionAddress<P extends string, R extends string>(
  page: P,
  region: R,
): RegionAddress<P, R> {
  return `${pageId(page)}/${regionName(region)}`;
}

export function overlayAddress<P extends string, O extends string>(
  page: P,
  overlay: O,
): OverlayAddress<P, O> {
  return `${pageId(page)}/${overlayName(overlay)}`;
}
