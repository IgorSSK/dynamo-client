/**
 * A union of attribute types.
 */
export type AttributeType = string | number | boolean | object | null;

/**
 * Extract all template keys (both required and optional) from a string template.
 *
 * For example:
 *   - "USER#{userId}"       yields "userId"
 *   - "ORDER#{?orderId}"     yields "orderId"
 */
export type ExtractTemplateKeys<T extends string> =
  T extends `${infer _Start}#{${infer Key}}${infer Rest}`
    ? Key extends `?${infer R}`
      ? R | ExtractTemplateKeys<Rest>
      : Key | ExtractTemplateKeys<Rest>
    : never;

/**
 * Extract only the optional keys (i.e. those preceded by a "?" marker)
 * from a string template.
 */
export type ExtractOptionalTemplateKeys<T extends string> =
  T extends `${infer _Start}#{?${infer Key}}${infer Rest}`
    ? Key | ExtractOptionalTemplateKeys<Rest>
    : never;

/**
 * The required keys are those keys found in the template minus the optional ones.
 */
export type ExtractRequiredTemplateKeys<T extends string> = Exclude<
  ExtractTemplateKeys<T>,
  ExtractOptionalTemplateKeys<T>
>;

/**
 * Given a template string, build an object type where:
 * - Required keys are required properties (of type string)
 * - Optional keys are optional properties (of type string)
 */
export type TemplateVariables<T extends string> = {
  [K in ExtractRequiredTemplateKeys<T>]: string;
} & {
  [K in ExtractOptionalTemplateKeys<T>]?: string;
};

/**
 * A Attribute represents a field in our schema. It carries:
 * - An optional attribute name.
 * - An optional transform function to convert a raw value.
 *
 * The generic parameter T is used to “store” the expected type.
 */
export class Attribute<T> {
  // This field exists only for type information.
  public _type!: T;

  constructor(
    public attrName?: string,
    public transform?: (value: any) => any
  ) {}

  /**
   * If a template is provided, return a TemplateKey instance (which is a kind
   * of Attribute that “parses” a template string to extract variable keys).
   */
  public template<Template extends string>(
    template: Template
  ): TemplateKey<Template> {
    return new TemplateKey(template, this.attrName);
  }
}

/**
 * A TemplateKey extends Attribute and holds a template literal string that
 * can be “filled in” with values. It extracts required and optional keys from
 * the template.
 *
 * For example, given the template "USER#{userId}-ORDER#{?orderId}" it will:
 *   - Extract "userId" as required.
 *   - Extract "orderId" as optional.
 */
export class TemplateKey<Template extends string> extends Attribute<
  TemplateVariables<Template>
> {
  // At runtime we “remember” the keys (for validation and generation).
  private requiredKeys: Array<ExtractRequiredTemplateKeys<Template>> = [];
  private optionalKeys: Array<ExtractOptionalTemplateKeys<Template>> = [];

  constructor(
    private templateString: Template,
    attrName?: string
  ) {
    super(attrName);
    this.parseTemplate(templateString);
  }

  /**
   * Parses the template string and populates the required and optional keys.
   * The expected pattern is:
   *   - `#{key}` for required keys
   *   - `#{?key}` for optional keys
   */
  private parseTemplate(template: string): void {
    // Notice the regex includes the literal '#' so that the runtime parsing
    // matches our compile-time template literal types.
    const regex = /\{(\??)(\w+)\}/g;
    let match: RegExpExecArray | null;
    while (true) {
      match = regex.exec(template);
      if (match === null) break;
      const [, optionalFlag, key] = match;
      if (optionalFlag === "?") {
        this.optionalKeys.push(key as ExtractOptionalTemplateKeys<Template>);
      } else {
        this.requiredKeys.push(key as ExtractRequiredTemplateKeys<Template>);
      }
    }
  }

  /**
   * Generates a string by replacing the placeholders with the provided values.
   * It also validates that all required keys are present.
   */
  public generate(values: TemplateVariables<Template>): string {
    // Validate that all required keys are provided.
    for (const key of this.requiredKeys) {
      if (!(key in values)) {
        throw new Error(`Missing required value for ${key}`);
      }
    }
    return this.templateString.replace(/\{(\??)(\w+)\}/g, (_, _flag, key) => {
      return values[key as keyof TemplateVariables<Template>] ?? "";
    });
  }
}
