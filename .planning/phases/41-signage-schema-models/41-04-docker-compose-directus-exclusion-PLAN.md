---
phase: 41-signage-schema-models
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - docker-compose.yml
autonomous: true
requirements:
  - SGN-DB-04
  - SGN-INF-02
must_haves:
  truths:
    - "Directus Data Model UI exposes signage_media, signage_playlists, signage_playlist_items, signage_device_tags, signage_device_tag_map, signage_playlist_tag_map after `docker compose up`"
    - "Directus does NOT introspect signage_devices or signage_pairing_sessions (they are in DB_EXCLUDE_TABLES)"
    - "`api` container has a read-only bind mount of `directus_uploads` at `/directus/uploads`"
    - "`directus` service waits for `migrate` to complete successfully before starting (already present — verify)"
  artifacts:
    - path: docker-compose.yml
      provides: "DB_EXCLUDE_TABLES updated with 2 signage private tables; api gets directus_uploads RO mount"
      contains: "signage_devices,signage_pairing_sessions"
  key_links:
    - from: docker-compose.yml api service volumes
      to: directus_uploads named volume
      via: ":ro mount at /directus/uploads"
      pattern: "directus_uploads:/directus/uploads:ro"
    - from: docker-compose.yml directus service environment
      to: DB_EXCLUDE_TABLES value
      via: "appended comma-separated, no spaces"
      pattern: "signage_devices,signage_pairing_sessions"
---

<objective>
Make two surgical edits to `docker-compose.yml`:
1. Add `signage_devices` and `signage_pairing_sessions` to the existing `DB_EXCLUDE_TABLES` env var on the `directus` service (SGN-DB-04). Other 6 signage tables remain visible to Directus.
2. Add `directus_uploads:/directus/uploads:ro` volume mount to the `api` service so FastAPI can read uploaded media files (SGN-INF-02). The named volume already exists; the `directus` service already mounts it rw.

Verify (do not re-add) that `directus`' `depends_on` already includes `migrate.condition: service_completed_successfully` — research confirms it is already present. If somehow missing, add it.

Purpose: Close SGN-DB-04 and SGN-INF-02. These two edits are the only Compose-level changes Phase 41 needs.

Output: One edited file; two changes; zero regressions to existing 11-table exclusion list.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/41-signage-schema-models/41-CONTEXT.md
@.planning/phases/41-signage-schema-models/41-RESEARCH.md
@docker-compose.yml

<interfaces>
Existing line in docker-compose.yml (confirmed via read):
```
DB_EXCLUDE_TABLES: upload_batches,sales_records,app_settings,personio_employees,personio_attendance,personio_absences,personio_sync_meta,alembic_version,sensors,sensor_readings,sensor_poll_log
```
No spaces after commas — Directus does NOT trim whitespace (RESEARCH Pitfall 6).

Existing `api` service `volumes:` block currently contains:
```
    volumes:
      - ./backend:/app
```
Additional volume must be appended.

Existing `directus` service `depends_on:` already has:
```
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
```
(Already present — verify only; no change needed per research "SGN-INF-02 state".)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Append signage private tables to DB_EXCLUDE_TABLES and add RO media mount to api</name>
  <files>docker-compose.yml</files>
  <read_first>
    - docker-compose.yml (read full current content — must preserve all other config)
    - .planning/phases/41-signage-schema-models/41-RESEARCH.md (sections "Directus Introspection Exclusion", "Docker Compose Migrate-Service Pattern", "Pitfall 6: DB_EXCLUDE_TABLES Syntax — No Spaces After Commas")
    - .planning/phases/41-signage-schema-models/41-CONTEXT.md (decisions D-17, D-18)
  </read_first>
  <action>
    **Edit 1: DB_EXCLUDE_TABLES.**
    Locate the line in the `directus` service environment:
```
      DB_EXCLUDE_TABLES: upload_batches,sales_records,app_settings,personio_employees,personio_attendance,personio_absences,personio_sync_meta,alembic_version,sensors,sensor_readings,sensor_poll_log
```
    Replace with (append `,signage_devices,signage_pairing_sessions` — NO spaces):
```
      DB_EXCLUDE_TABLES: upload_batches,sales_records,app_settings,personio_employees,personio_attendance,personio_absences,personio_sync_meta,alembic_version,sensors,sensor_readings,sensor_poll_log,signage_devices,signage_pairing_sessions
```
    The other 6 signage tables (`signage_media`, `signage_playlists`, `signage_playlist_items`, `signage_device_tags`, `signage_device_tag_map`, `signage_playlist_tag_map`) are intentionally OMITTED from DB_EXCLUDE_TABLES — they must be visible to Directus per D-17 and research open-question 5 (join tables exposed for relational editing).

    **Edit 2: Add directus_uploads RO mount to api service.**
    Locate the `api` service volumes block:
```
    volumes:
      - ./backend:/app
```
    Replace with:
```
    volumes:
      - ./backend:/app
      # Directus owns the uploads volume (rw on directus service, ro here).
      # FastAPI reads media files by path resolved from signage_media.uri (Directus asset UUID) — SGN-INF-02.
      - directus_uploads:/directus/uploads:ro
```

    **Edit 3: Verify migrate → directus ordering (NO-OP if already present).**
    Confirm the `directus` service `depends_on` already contains:
```
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
```
    If confirmed (research says it IS present), take no action. If missing, add the `migrate` clause. The verification step below greps for this pattern unconditionally.

    Do NOT reformat unrelated sections of the file. Do NOT edit the `frontend`, `db`, `migrate`, `directus-bootstrap-roles`, or `backup` services.

    This implements SGN-DB-04, SGN-INF-02, and decisions D-17, D-18.
  </action>
  <verify>
    <automated>grep -q 'signage_devices,signage_pairing_sessions' docker-compose.yml && grep -q 'directus_uploads:/directus/uploads:ro' docker-compose.yml && grep -A2 'migrate:' docker-compose.yml | grep -q 'service_completed_successfully' && ! grep -qE 'DB_EXCLUDE_TABLES:.*signage_media|DB_EXCLUDE_TABLES:.*signage_playlists($|,)' docker-compose.yml</automated>
  </verify>
  <acceptance_criteria>
    - `signage_devices` and `signage_pairing_sessions` appear in DB_EXCLUDE_TABLES line, comma-joined, no spaces: `grep -q 'DB_EXCLUDE_TABLES:.*signage_devices,signage_pairing_sessions' docker-compose.yml`
    - Other 6 signage tables NOT in DB_EXCLUDE_TABLES: `! grep -qE 'DB_EXCLUDE_TABLES:[^#]*signage_media[^_]' docker-compose.yml && ! grep -qE 'DB_EXCLUDE_TABLES:[^#]*signage_playlists[^_]' docker-compose.yml && ! grep -qE 'DB_EXCLUDE_TABLES:[^#]*signage_playlist_items' docker-compose.yml && ! grep -qE 'DB_EXCLUDE_TABLES:[^#]*signage_device_tags[^_]' docker-compose.yml && ! grep -qE 'DB_EXCLUDE_TABLES:[^#]*signage_device_tag_map' docker-compose.yml && ! grep -qE 'DB_EXCLUDE_TABLES:[^#]*signage_playlist_tag_map' docker-compose.yml`
    - No spaces in DB_EXCLUDE_TABLES value (Pitfall 6): `grep 'DB_EXCLUDE_TABLES:' docker-compose.yml | grep -q ', ' && exit 1 || true` (no comma-space sequences)
    - api service has directus_uploads RO mount: `grep -q 'directus_uploads:/directus/uploads:ro' docker-compose.yml`
    - directus service still depends on migrate with service_completed_successfully: `awk '/^  directus:/,/^  [a-z]/' docker-compose.yml | grep -q 'service_completed_successfully'`
    - File is valid YAML: `python -c "import yaml; yaml.safe_load(open('docker-compose.yml'))"` exits 0
    - `docker compose config` parses without error: `docker compose config > /dev/null 2>&1 || echo "compose config failed"` — expect no "compose config failed" message
  </acceptance_criteria>
  <done>DB_EXCLUDE_TABLES extended with the 2 sensitive signage tables; api service gets a read-only directus_uploads mount at /directus/uploads; migrate-before-directus ordering confirmed; docker-compose.yml still parses as valid YAML.</done>
</task>

</tasks>

<verification>
```
# YAML valid + compose parses
python -c "import yaml; yaml.safe_load(open('docker-compose.yml'))"
docker compose config > /tmp/compose-config-41-04.yaml

# Confirm the two sensitive tables are excluded, the other 6 are visible
grep 'DB_EXCLUDE_TABLES' docker-compose.yml

# Confirm the api mount
grep -n 'directus_uploads' docker-compose.yml
```
</verification>

<success_criteria>
- DB_EXCLUDE_TABLES includes signage_devices + signage_pairing_sessions
- DB_EXCLUDE_TABLES does NOT include the other 6 signage tables
- api service mounts directus_uploads as `:ro` at /directus/uploads
- `directus.depends_on.migrate.condition` is `service_completed_successfully`
- docker-compose.yml still parses as valid YAML
</success_criteria>

<output>
After completion, create `.planning/phases/41-signage-schema-models/41-04-SUMMARY.md` capturing: the exact before/after of the DB_EXCLUDE_TABLES line, the exact api volumes block after the edit, and the `docker compose config` status.
</output>
