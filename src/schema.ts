// src/schema.ts

import { QueryBuilder } from "./queryBuilder";

/**
 * A union of attribute types.
 */
export type AttributeType = string | number | boolean | object | null;

/**
 * A map where keys are strings and values are SchemaField instances.
 */
export type SchemaDefinition = Record<string, SchemaField<any>>;

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
 * A SchemaField represents a field in our schema. It carries:
 * - An optional attribute name.
 * - An optional transform function to convert a raw value.
 *
 * The generic parameter T is used to “store” the expected type.
 */
export class SchemaField<T> {
  // This field exists only for type information.
  public _type!: T;

  constructor(
    public attrName?: string,
    public transform?: (value: any) => any
  ) {}

  /**
   * If a template is provided, return a TemplateKey instance (which is a kind
   * of SchemaField that “parses” a template string to extract variable keys).
   */
  public template<Template extends string>(
    template: Template
  ): TemplateKey<Template> {
    return new TemplateKey(template, this.attrName);
  }
}

/**
 * A TemplateKey extends SchemaField and holds a template literal string that
 * can be “filled in” with values. It extracts required and optional keys from
 * the template.
 *
 * For example, given the template "USER#{userId}-ORDER#{?orderId}" it will:
 *   - Extract "userId" as required.
 *   - Extract "orderId" as optional.
 */
export class TemplateKey<Template extends string> extends SchemaField<
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
    // Replace the placeholders using the same regex.
    return this.templateString.replace(/\{(\??)(\w+)\}/g, (_, _flag, key) => {
      return values[key as keyof TemplateVariables<Template>] ?? "";
    });
  }
}

/**
 * A helper class to create various field types.
 */

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class TableSchema {
  /**
   * Create a primary key field.
   */
  public static pk(attributeName?: string) {
    return new SchemaField<TemplateVariables<any>>(attributeName);
  }

  /**
   * Create a sort key field.
   */
  public static sk(attributeName?: string) {
    return new SchemaField<TemplateVariables<any>>(attributeName);
  }

  /**
   * Create a string field.
   */
  public static string(attributeName?: string) {
    return new SchemaField<string>(attributeName);
  }

  /**
   * Create an object field.
   */
  public static object(attributeName?: string) {
    return new SchemaField<object>(attributeName);
  }

  /**
   * Create a date field with an optional transform.
   */
  public static date(attributeName?: string) {
    return new SchemaField<Date>(attributeName, (value: any) =>
      new Date(value).toISOString()
    );
  }

  // Uncomment and extend as needed for global secondary indexes (GSI)
  // public static gsi(indexName: string) {
  // 	return {
  // 		pk: (key: string, metadata?: any) => new SchemaField(key, metadata),
  // 		sk: (key: string, metadata?: any) => new SchemaField(key, metadata),
  // 	};
  // }
}

/**
 * Options to configure the schema.
 */
export interface SchemaOptions {
  transform?: {
    toSnakeCase?: boolean;
  };
}

/**
 * The DynamoSchema class is the entry point for configuring a table.
 * It stores the table and region names, accepts a schema definition,
 * and returns a SchemaBuilder to populate a concrete item.
 */
export class DynamoSchema {
  private tableName!: string;
  private regionName!: string;
  private schemaDefinition!: SchemaDefinition;
  private schemaOptions?: SchemaOptions;

  private constructor(name: string) {
    this.tableName = name;
  }

  /**
   * Create a new DynamoSchema instance.
   */
  public static table(name: string): DynamoSchema {
    return new DynamoSchema(name);
  }

  /**
   * Set the region for the table.
   */
  public region(name: string): this {
    this.regionName = name;
    return this;
  }

  /**
   * Define the schema along with optional options.
   */
  public schema<T extends SchemaDefinition>(
    definition: T,
    options?: SchemaOptions
  ): this {
    this.schemaDefinition = definition;
    this.schemaOptions = options;
    return this;
  }

  /**
   * Creates a new SchemaBuilder instance with the schema definition.
   */
  public createBuilder(): SchemaBuilder<SchemaDefinition> {
    return new SchemaBuilder(this.schemaDefinition, this.schemaOptions);
  }

  public createQueryBuilder(): QueryBuilder<SchemaDefinition> {
    return new QueryBuilder(this.schemaDefinition, this.schemaOptions);
  }
}

/**
 * The SchemaBuilder is responsible for “filling in” the schema with actual values.
 */
export class SchemaBuilder<T extends SchemaDefinition> {
  private values: Record<string, any> = {};

  constructor(
    private definition: T,
    private options?: SchemaOptions
  ) {}

  /**
   * Sets a value for the given key.
   * If the field is a TemplateKey and the value is an object,
   * then the template is generated.
   */
  public set<K extends keyof T>(key: K, value: T[K]["_type"]): this {
    const field = this.definition[key as string];
    if (
      field instanceof TemplateKey &&
      typeof value === "object" &&
      value !== null
    ) {
      this.values[key as string] = field.generate(
        value as Record<string, string>
      );
    } else {
      this.values[key as string] = field.transform
        ? field.transform(value)
        : value;
    }
    return this;
  }

  /**
   * Converts a camelCase key to snake_case.
   */
  private toSnakeCase(key: string): string {
    return key.replace(/([A-Z])/g, "_$1").toLowerCase();
  }

  /**
   * Returns the final built object.
   */
  public build(): Record<string, any> {
    const finalValues: Record<string, any> = {};

    for (const key in this.values) {
      const field = this.definition[key];
      const fieldKey =
        field?.attrName ??
        (this.options?.transform?.toSnakeCase ? this.toSnakeCase(key) : key);
      finalValues[fieldKey] = this.values[key];
    }

    return finalValues;
  }
}

const schema = DynamoSchema.table("my_table")
  .region("us-east-1")
  .schema(
    {
      pk: TableSchema.pk("my_pk").template("USER#{userId}"),
      sk: TableSchema.sk("my_sk").template("ORDER#{?orderId}"),
      orderDate: TableSchema.date(),
      address: TableSchema.string(),
      metadata: TableSchema.object(),
    },
    { transform: { toSnakeCase: true } }
  );

// Build an item using the schema builder.
const item = schema
  .createBuilder()
  .set("", "")
  .set("sk", {}) // optional value may be omitted or empty
  .set("orderDate", new Date())
  .set("address", "123 Fake St")
  .set("metadata", { foo: "bar" })
  .build();
