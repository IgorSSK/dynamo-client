/**
 * A helper class to create various field types.
 */

import { Attribute, type TemplateVariables } from "./attribute";

export class TableSchema {
  /**
   * Create a primary key field.
   */
  public static pk(attributeName?: string) {
    return new Attribute<TemplateVariables<any>>(attributeName);
  }

  /**
   * Create a sort key field.
   */
  public static sk(attributeName?: string) {
    return new Attribute<TemplateVariables<any>>(attributeName);
  }

  /**
   * Create a string field.
   */
  public static string(attributeName?: string) {
    return new Attribute<string>(attributeName);
  }

  /**
   * Create an object field.
   */
  public static object(attributeName?: string) {
    return new Attribute<object>(attributeName);
  }

  /**
   * Create a date field with an optional transform.
   */
  public static date(attributeName?: string) {
    return new Attribute<Date>(attributeName, (value: any) =>
      new Date(value).toISOString()
    );
  }

  public gsi(indexName: string) {
    return {
      pk: (attributeName?: string) => new Attribute<string>(attributeName),
      sk: (attributeName?: string) => new Attribute<string>(attributeName),
    };
  }
}
