/**
 * Contracts shared by the kernel and every plugin.
 *
 * Plugins extend the three "maps" below with TypeScript declaration merging,
 * so events, services and extension points stay type-safe without the core
 * knowing about any plugin:
 *
 *   declare module '@hdt/core' {
 *     interface EventMap { 'tuvi.chartComputed': { personId: string } }
 *   }
 */

// ---------- Shared domain primitives ----------

export type PersonId = string;
export type Gender = 'male' | 'female';

export interface BirthInfo {
  /** Solar date, yyyy-mm-dd, local time of birth place. */
  date?: string;
  /** Clock hour 0–23. null = person said they don't know. */
  hour?: number | null;
  place?: string;
  /** IANA-style offset in hours used for lunar conversion. Default +7 (Vietnam). */
  timeZone?: number;
}

export interface Person {
  id: PersonId;
  fullName: string;
  gender?: Gender;
  birth: BirthInfo;
  /** A "shadow" person was added by someone else (e.g. a parent) and has no account. */
  shadow: boolean;
  createdBy?: PersonId;
  createdAt: string;
  updatedAt: string;
}

export type ConsentScope = 'health' | 'family' | 'community.visible' | 'matching';

// ---------- Facts: the single path every collected datum takes ----------

export type FactStatus = 'proposed' | 'confirmed' | 'rejected';

export interface FactSource {
  type: 'chat' | 'import' | 'form' | 'device' | 'system';
  topic?: string;
  ref?: string;
}

export interface FactDraft {
  /** Namespaced kind owned by one plugin, e.g. 'person.birthDate', 'body.observation'. */
  kind: string;
  /** Who reported it. */
  personId: PersonId;
  /** Who it is about (defaults to personId), e.g. Mẹ's id for her birth hour. */
  subjectId?: PersonId;
  value: unknown;
  /** Human-readable summary shown on the "saved" card. */
  summary: string;
  /** 0–1. Extractors should be honest; low confidence should ask, not save. */
  confidence: number;
  source: FactSource;
}

export interface Fact extends FactDraft {
  id: string;
  subjectId: PersonId;
  status: FactStatus;
  createdAt: string;
  decidedAt?: string;
}

export interface FactHandler {
  kind: string;
  /** Consent the *subject* must have granted before this fact can be stored. */
  requiresConsent?: ConsentScope;
  /** Validate and normalise the value; throw HttpError(422) if invalid. */
  validate?(value: unknown): unknown;
  /** Apply a confirmed fact to the owning plugin's data. */
  apply(fact: Fact): Promise<void> | void;
}

// ---------- Chat extension points (consumed by the chat plugin) ----------

export interface ChatInput {
  personId: PersonId;
  topic: string;
  text: string;
  /** The fact kind the assistant just asked for, so short answers ("Nguyễn An") can be read. */
  awaiting?: string;
}

export interface ChatExtractor {
  id: string;
  /** Topics this extractor listens to; omit for all topics. */
  topics?: string[];
  extract(input: ChatInput): Promise<FactDraft[]> | FactDraft[];
}

export interface ChatReply {
  text: string;
  /** Next fact kind the assistant is waiting for, echoed back by the client. */
  awaiting?: string;
  actions?: { label: string; action: string }[];
  /** Safety flags such as 'urgent-care'. */
  flags?: string[];
}

export interface ChatTopic {
  id: string;
  title: string;
  description?: string;
  respond(input: ChatInput & { proposed: Fact[] }): Promise<ChatReply> | ChatReply;
}

// ---------- HTTP-agnostic routes ----------

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteRequest {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: any;
  /** Authenticated caller; filled by the API layer. */
  actorId?: PersonId;
}

export interface RouteDef {
  method: HttpMethod;
  /** Relative to the plugin, e.g. '/charts/:personId'. Mounted at /api/<pluginId>. */
  path: string;
  summary?: string;
  handler(req: RouteRequest): Promise<unknown> | unknown;
}

export interface MountedRoute extends RouteDef {
  pluginId: string;
  fullPath: string;
}

// ---------- Extensible maps ----------

/** Events: plugins add their own keys via declaration merging. */
export interface EventMap {
  'person.created': { person: Person };
  'person.updated': { person: Person; changed: string[] };
  'fact.proposed': { fact: Fact };
  'fact.confirmed': { fact: Fact };
  'fact.rejected': { fact: Fact };
  'consent.changed': { personId: PersonId; scope: ConsentScope; granted: boolean };
}

/** Services one plugin offers to others. Plugins add keys via declaration merging. */
export interface ServiceMap {}

/** Extension points: many plugins contribute, one plugin consumes. */
export interface ExtensionMap {
  'chat.topic': ChatTopic;
  'chat.extractor': ChatExtractor;
}
