# Audit Trail Specification
# Fraud Detection Platform

| Item | Detail |
|---|---|
| Document | Audit Trail Specification |
| Version | 1.0 (review ke liye draft) |
| Date | 10 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Related documents | Access Control aur Security Design; Data Privacy aur Retention Policy; Labeling aur Ground-Truth Policy; Continuous Learning aur Retraining Design |

**Status ka matlab:** **Bana hua** = abhi log hota hai; **Gap** = log nahi hota, banana hai; **Planned** = automation ke saath banega.

---

## 1. Purpose

Baad me har faisle aur har score ki wajah batayi ja sake: jhagde, client ke sawaal, aur audit ke liye. Ye document tay karta hai:
- kya log hota hai
- har log me kya fields hain
- logs badle na ja sakein, iske liye kya kiya jaata hai
- logs kitne time rakhe jaate hain aur kaun padh sakta hai

---

## 2. Buniyadi Niyam

1. Har log me **kisne, kya, kab, kis cheez pe**, aur jahan ho sake **kyun**.
2. **Sirf jodna (append-only):** application log tables me UPDATE ya DELETE nahi karti. Badlav naya row banta hai.
3. **Time:**
   - panel ke records me IST minute tak
   - platform aur ingest ke records me UTC
   - naye audit events me UTC seconds tak, aur servers NTP se synced
4. **Kisi bhi score ko trace karna:** request → data ka export → features → model version → release.
5. Logs me passwords, tokens ya API keys kabhi nahi.

---

## 3. Events ki List

### 3.1 Review Panel
| Event | Kahan | Fields | Status |
|---|---|---|---|
| Decision submit ya badlav | `review.db` → `decision_log` | player, user_id, code, record_id, decision, reason, reviewer, score, at | Bana hua |
| Decision hatana | `decision_log` | Upar jaisa, `decision = "cleared"`, hatane wala, time | Bana hua |
| Pattern answer | `review.db` → `pattern_check_log` | record_id, pattern, fits (1/0/2), note, reviewer, at, code, user_id | Bana hua |
| Pattern note likhna | `pattern_notes` | id, pattern, note, author, at | Bana hua |
| Pattern note hatana | `pattern_notes.removed_at` (row rehti hai) | removed_at | Bana hua; **hatane wale ka naam nahi** (sirf apna note hata sakte hain, isliye author hi hai) |
| Sign-in koshish | `users.db` → `logins` | at, name, ip, ok | Bana hua |
| Session | `users.db` → `sessions` | token hash, name, created, seen, ip, browser, ended (`replaced` / sign-out / expiry) | Bana hua; purane sessions saaf ho jaate hain (Gap A-04) |
| Account banana / password badalna | `users.db` → `users.created`, `changed` | Sirf aakhri time | **Gap A-01:** kisne kiya aur poori history nahi |
| Account hatana | – | – | **Gap A-01:** row delete hoti hai, log nahi |
| Decisions CSV download | – | – | **Gap A-02** |
| Kisne kaunsa user/request dekha | nginx access log (IP + path, user nahi) | – | **Gap A-03** |

### 3.2 Data aur Models
| Event | Kahan | Fields | Status |
|---|---|---|---|
| Record ingest hua | Har risk event me | `ingested_at`, `batch_id` | Bana hua |
| Ingest batch | Ingest service ka jawab / logs | received, written, failed, batch_id, took_ms | Bana hua (Docker logs, 150 MB tak) |
| Dataset banna | `summary.txt`, `dataset.csv` | Counts, label groups | Bana hua (overwrite hota hai, Gap A-05) |
| Review list ke faisle | `prepare.py` me comments ke saath list | User, request time, pattern, date aur wajah | Bana hua (code me) |
| Anomaly model version | `models/versions/`, `current_version.json`, weekly reports | Version, date, test numbers, faisla | Bana hua |
| Fraud % model train | `cv_report.txt`, `fraud_pct.joblib` | Metrics | Bana hua (overwrite, Gap A-05) |
| Scoring | `score_summary.txt` | Counts, bands | Bana hua (overwrite) |
| Label snapshot | Run ke saath | Har request ka label aur source | Planned |
| Run manifest | `runs/<run id>/` | Inputs, code version, outputs, counts, metrics, gates | Planned |
| Release | Release manifest | Release id, models, data, checksums, approver, time | Planned |
| Panel update (abhi) | – | – | **Gap A-06:** `push_update.ps1` ka log nahi |
| Rollback | Rollback log | Kisne, kab, kis release pe, wajah | Planned |
| Score limit ka badlav | Score aur Threshold Policy ka change log | Kya, kyun, approver | Bana hua (manual) |
| Data delete | Deletion log | Kya, kitna, kab, kisne | Planned |

### 3.3 Servers
| Event | Kahan | Status |
|---|---|---|
| SSH sign-in, `sudo` commands | `/var/log/auth.log` (Ubuntu) | Bana hua (system default) |
| Panel service start/stop/error | journald | Bana hua |
| Web requests | nginx access log | Bana hua |
| Backup chala | cron / S3 file ka time | Bana hua (S3 me file) |

---

## 4. Naye Audit Events ka Format

Gaps band karne ke liye ek `audit_log` table (panel) aur run/release manifests (pipeline) banenge. Har row:

| Field | Matlab |
|---|---|
| `event_id` | Unique id |
| `at` | UTC, seconds tak |
| `actor` | User ka naam, ya service (`release-agent`, `pipeline`, `admin-cli`) |
| `actor_ip` | Jahan se |
| `action` | Jaise `account.create`, `account.remove`, `password.change`, `export.decisions_csv`, `view.request`, `release.apply`, `release.rollback` |
| `object_type`, `object_id` | Kis cheez pe (account, request, release) |
| `before`, `after` | Badlav (passwords aur tokens kabhi nahi) |
| `reason` | Jahan zaroori: rollback, manual run, account hatana |
| `run_id` / `release_id` | Pipeline events ke liye |

---

## 5. Logs Badle Na Ja Sakein

| Control | Status |
|---|---|
| Application log tables me sirf INSERT | Bana hua (`decision_log`, `pattern_check_log`) |
| Database files sirf `panel` user padh/likh sake (640/750) | Bana hua |
| `review.db` ka roz S3 backup | Bana hua (live pe confirm) |
| S3 backups pe Object Lock (WORM), taaki koi delete ya overwrite na kar sake | Planned |
| Har din ke audit log ka hash, agle din ke hash me (hash chain) | Planned |
| Server time NTP se synced | Ubuntu default; confirm karna hai |

---

## 6. Retention aur Access

| Log | Rakhna | Kaun padh sakta hai |
|---|---|---|
| Decisions aur pattern answers ki history | Decision ke baad 5 saal (ya client ki AML policy) | MiraiGate admin; client risk lead request pe |
| Sign-in log aur sessions | 12 mahine | MiraiGate admin |
| Naya `audit_log` | 5 saal | MiraiGate admin; client risk lead request pe |
| Run manifests, label snapshots, release aur rollback logs | Run reports hamesha; label snapshots 24 mahine | MiraiGate data team |
| Server logs (auth, nginx, journald, Docker) | 180 din kam se kam | MiraiGate admin |

**Audit export:** client ya auditor ki likhit request pe MiraiGate admin export banata hai. Export ka bhi audit event banta hai.

---

## 7. Aam Audit Sawaal

**Ek player pe saare faisle, purane se naye:**
```sql
SELECT at, decision, reason, reviewer, score, record_id
FROM decision_log WHERE player = :player ORDER BY id;
```

**Ek reviewer ke ek din ke faisle:**
```sql
SELECT at, player, decision, reason FROM decision_log
WHERE reviewer = :name AND at LIKE '2026-10-09%' ORDER BY id;
```

**Ek request pe pattern answers ki history:**
```sql
SELECT at, pattern, fits, note, reviewer FROM pattern_check_log
WHERE record_id = :record_id ORDER BY id;
```

**Ek account ki sign-in koshishein (`users.db`):**
```sql
SELECT datetime(at, 'unixepoch', '+5 hours', '+30 minutes') AS at_ist, ip, ok
FROM logins WHERE name = :name ORDER BY at DESC LIMIT 50;
```

**Kisi score ki wajah:** request ka `record_id` → panel me "Why this score" → us run ki `score_summary.txt` aur model version → `prepare.py` me request ka label aur review list.

---

## 8. Gaps aur Actions

| ID | Gap | Action | Priority |
|---|---|---|---|
| A-01 | Account banana, hatana, password badalna ka audit nahi | `accounts.py` me `audit_log` entry, admin ke naam ke saath | P1 |
| A-02 | Decisions CSV download ka log nahi | `audit_log` me `export.decisions_csv` | P2 |
| A-03 | Kisne kaunsa request dekha, log nahi | Request page aur activity API pe `view.request` | P2 |
| A-04 | Purane sessions table se saaf ho jaate hain | Session khatam hone pe `audit_log` me entry | P2 |
| A-05 | Datasets, reports aur models overwrite hote hain | Run manifest aur versioned registry (Phase 2) | P1 |
| A-06 | Panel update (`push_update.ps1`) ka log nahi | Install script server pe ek line log likhe; baad me release manifest | P1 |
| A-07 | Backups delete ho sakte hain | S3 Object Lock | P2 |

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
