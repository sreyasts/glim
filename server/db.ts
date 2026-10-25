import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AlertEvent, Rule, RuleInput } from '../shared/types';

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS favorites (owner TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, camera TEXT NOT NULL, PRIMARY KEY(owner,camera));
      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        camera TEXT NOT NULL, kind TEXT NOT NULL, threshold REAL NOT NULL, enabled INTEGER NOT NULL,
        created INTEGER NOT NULL, triggered INTEGER, matched INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS rules_owner ON rules(owner);
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        rule TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE, camera TEXT NOT NULL,
        title TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_owner ON events(owner, created DESC);
      CREATE TABLE IF NOT EXISTS push (owner TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE, subscription TEXT NOT NULL);
    `);
  }
  session(raw?: string): { owner: string; token?: string } {
    const owner = raw && /^[a-f0-9]{64}$/.test(raw) ? createHash('sha256').update(raw).digest('hex') : '';
    if (owner && this.db.prepare('SELECT id FROM sessions WHERE id=? AND expires>?').get(owner, Date.now())) return { owner };
    const token = randomBytes(32).toString('hex');
    const id = createHash('sha256').update(token).digest('hex');
    this.db.prepare('INSERT INTO sessions VALUES (?,?)').run(id, Date.now() + 30 * 86400000);
    return { owner: id, token };
  }
  favorites(owner: string): string[] {
    return (this.db.prepare('SELECT camera FROM favorites WHERE owner=? ORDER BY rowid').all(owner) as { camera: string }[]).map(row => row.camera);
  }
  favorite(owner: string, camera: string, saved: boolean): void {
    this.db.prepare(saved ? 'INSERT OR IGNORE INTO favorites VALUES (?,?)' : 'DELETE FROM favorites WHERE owner=? AND camera=?').run(owner, camera);
  }
  rules(owner: string): Rule[] {
    return this.db.prepare('SELECT id,camera AS cameraId,kind,threshold,enabled,created AS createdAt,triggered AS lastTriggeredAt FROM rules WHERE owner=? ORDER BY created DESC').all(owner).map(row => ({ ...row, enabled: Boolean(row.enabled) })) as unknown as Rule[];
  }
  addRule(owner: string, input: RuleInput): Rule {
    const existing = this.db.prepare('SELECT id FROM rules WHERE owner=? AND camera=? AND kind=? AND threshold=?').get(owner, input.cameraId, input.kind, input.threshold);
    if (existing) throw new Error('An identical alert already exists.');
    const rule: Rule = { ...input, id: randomUUID(), createdAt: Date.now(), lastTriggeredAt: null };
    this.db.prepare('INSERT INTO rules (id,owner,camera,kind,threshold,enabled,created) VALUES (?,?,?,?,?,?,?)').run(rule.id, owner, rule.cameraId, rule.kind, rule.threshold, Number(rule.enabled), rule.createdAt);
    return rule;
  }
  setRule(owner: string, id: string, enabled: boolean): boolean {
    return this.db.prepare('UPDATE rules SET enabled=?,matched=0 WHERE owner=? AND id=?').run(Number(enabled), owner, id).changes > 0;
  }
  deleteRule(owner: string, id: string): boolean {
    return this.db.prepare('DELETE FROM rules WHERE owner=? AND id=?').run(owner, id).changes > 0;
  }
  activeRules(): (Rule & { owner: string; matched: number })[] {
    return this.db.prepare('SELECT id,owner,camera AS cameraId,kind,threshold,enabled,created AS createdAt,triggered AS lastTriggeredAt,matched FROM rules WHERE enabled=1').all().map(row => ({ ...row, enabled: true })) as unknown as (Rule & { owner: string; matched: number })[];
  }
  recordEvaluation(rule: Rule & { owner: string }, matched: boolean, event?: Omit<AlertEvent, 'id' | 'createdAt'>): AlertEvent | null {
    const createdAt = Date.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE rules SET matched=?,triggered=CASE WHEN ? THEN ? ELSE triggered END WHERE id=? AND enabled=1').run(Number(matched), Number(Boolean(event)), createdAt, rule.id);
      let result: AlertEvent | null = null;
      if (event) {
        result = { ...event, id: randomUUID(), createdAt };
        this.db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?)').run(result.id, rule.owner, result.ruleId, result.cameraId, result.title, result.body, createdAt);
      }
      this.db.exec('COMMIT');
      return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  events(owner: string): AlertEvent[] {
    return this.db.prepare('SELECT id,rule AS ruleId,camera AS cameraId,title,body,created AS createdAt FROM events WHERE owner=? ORDER BY created DESC LIMIT 50').all(owner) as unknown as AlertEvent[];
  }
  push(owner: string): string | undefined { return (this.db.prepare('SELECT subscription FROM push WHERE owner=?').get(owner) as { subscription: string } | undefined)?.subscription; }
  savePush(owner: string, subscription: unknown): void { this.db.prepare('INSERT INTO push VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET subscription=excluded.subscription').run(owner, JSON.stringify(subscription)); }
  deletePush(owner: string): void { this.db.prepare('DELETE FROM push WHERE owner=?').run(owner); }
  cleanup(): void {
    this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    this.db.prepare('DELETE FROM events WHERE created<?').run(Date.now() - 30 * 86400000);
  }
  close(): void { this.db.close(); }
}
