// Ambient type declarations injected into Monaco so the editor offers
// autocomplete + hover docs for the mocked Glide APIs.

export const GLIDE_DTS = `
/** GlideElement — a field value read from a GlideRecord. */
declare class GlideElement {
  /** The raw stored value. */
  getValue(): string;
  /** The human-readable display value (choice label / referenced display field). */
  getDisplayValue(): string;
  /** True when the field is empty. */
  nil(): boolean;
  toString(): string;
}

/** GlideRecord — query, read and write table records. */
declare class GlideRecord {
  /** @param table e.g. 'incident', 'sys_user', 'change_request' */
  constructor(table: string);
  /** Add a filter. addQuery(field, value) or addQuery(field, operator, value). */
  addQuery(field: string, value: any): { addOrCondition(field: string, op: any, value?: any): any };
  addQuery(field: string, operator: string, value: any): { addOrCondition(field: string, op: any, value?: any): any };
  /** Filter using an encoded query string, e.g. 'active=true^priority=1'. */
  addEncodedQuery(encoded: string): GlideRecord;
  /** Shortcut for addQuery('active', true). */
  addActiveQuery(): any;
  addNotNullQuery(field: string): any;
  addNullQuery(field: string): any;
  orderBy(field: string): GlideRecord;
  orderByDesc(field: string): GlideRecord;
  setLimit(max: number): GlideRecord;
  /** Run the query. Call before next(). */
  query(): GlideRecord;
  /** Advance to the next record. Returns false when exhausted. */
  next(): boolean;
  hasNext(): boolean;
  /** Fetch one record by sys_id, or by (field, value). */
  get(sysId: string): boolean;
  get(field: string, value: string): boolean;
  getRowCount(): number;
  /** Raw stored value of a field. */
  getValue(field: string): string;
  /** Display value (choice label / reference display field). */
  getDisplayValue(field?: string): string;
  getElement(field: string): GlideElement;
  setValue(field: string, value: any): void;
  getUniqueValue(): string;
  getTableName(): string;
  isValidField(field: string): boolean;
  isValidRecord(): boolean;
  /** Start a new record for insert(). */
  initialize(): GlideRecord;
  newRecord(): GlideRecord;
  /** Insert the current record; returns its sys_id. */
  insert(): string;
  /** Save changes to the current record. */
  update(): string;
  deleteRecord(): boolean;
  deleteMultiple(): number;
  /** Any field is readable as gr.field_name (returns a GlideElement). */
  [field: string]: any;
}

/** GlideAggregate — COUNT / SUM / AVG / MIN / MAX, optionally grouped. */
declare class GlideAggregate {
  constructor(table: string);
  addQuery(field: string, value: any): GlideAggregate;
  addQuery(field: string, operator: string, value: any): GlideAggregate;
  addEncodedQuery(encoded: string): GlideAggregate;
  /** @param type 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' */
  addAggregate(type: string, field?: string): GlideAggregate;
  groupBy(field: string): GlideAggregate;
  query(): GlideAggregate;
  next(): boolean;
  getAggregate(type: string, field?: string): string;
  getValue(field: string): string;
  getDisplayValue(field: string): string;
  getRowCount(): number;
}

declare class GlideDateTime {
  constructor(value?: string);
  getValue(): string;
  getDisplayValue(): string;
  getNumericValue(): number;
  addSeconds(s: number): void;
  addDays(d: number): void;
  before(other: GlideDateTime): boolean;
  after(other: GlideDateTime): boolean;
}
declare class GlideDate extends GlideDateTime {}
declare class GlideDuration {
  constructor(ms: number);
  getDisplayValue(): string;
  getNumericValue(): number;
}

/** GlideSystem — logging, user info and utilities. Available as 'gs'. */
interface GlideSystem {
  /** Log at info level. Supports {0},{1}... substitution. */
  info(message: string, ...args: any[]): void;
  print(message: string, ...args: any[]): void;
  log(message: string): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  addInfoMessage(message: string): void;
  addErrorMessage(message: string): void;
  getUserName(): string;
  getUserID(): string;
  getUserDisplayName(): string;
  getProperty(name: string, fallback?: string): string;
  nowDateTime(): string;
  beginningOfToday(): string;
  endOfToday(): string;
  daysAgo(days: number): string;
  generateGUID(): string;
  eventQueue(name: string, record: any, p1?: any, p2?: any): void;
  hasRole(role: string): boolean;
  tableExists(table: string): boolean;
}
declare const gs: GlideSystem;
`
