# Access Control aur Security Design
# Fraud Detection Platform

| Item | Detail |
|---|---|
| Document | Access Control aur Security Design |
| Version | 1.0 (review ke liye draft) |
| Date | 10 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Related documents | System Architecture Document; Data Privacy aur Retention Policy; Audit Trail Specification; Incident Response Playbook |

**Status ka matlab:**
- **Bana hua** = abhi chal raha hai
- **Gap** = band karna hai (Section 11)
- **Planned** = automation ke saath banega

---

## 1. Purpose

Panel me client ka financial data dikhta hai: users ki deposits, withdrawals, bets aur jeet. Isliye access:
- seemit hona chahiye
- uska review hona chahiye
- log hona chahiye

Ye document tay karta hai ki kaun kya dekh aur badal sakta hai, sign-in kaise kaam karta hai, servers kaise surakshit hain, aur secrets kahan rehte hain.

---

## 2. Data Classification

| Class | Kya | Niyam |
|---|---|---|
| Restricted | Passwords, API keys, SSH keys, MongoDB password, session tokens | Sirf secret store me; kabhi code, chat, email ya documents me nahi |
| Confidential | Users ke codes, bets, statements, deposits, withdrawals, scores, decisions, notes | Sirf sign-in ke baad; encrypted transit; repository me kabhi nahi |
| Internal | Code, models, aggregate reports | MiraiGate aur client team |
| Public | Kuch nahi | – |

---

## 3. Roles

| Role | Kaun | Kaam |
|---|---|---|
| Reviewer | Client ke staff (User1–User6) | Queue dekhna, decisions, pattern answers, notes |
| Lead reviewer | Client ka ek reviewer (naam tay karna hai) | Takraav suljhana, naye patterns approve |
| Client risk lead | Client | Score limits approve, accounts ki approval |
| MiraiGate admin | MiraiGate | Servers, accounts banana/hatana, release, rollback |
| MiraiGate data team | MiraiGate | Data, models, retrain |
| Platform (system) | Client platform | Ingest API pe data bhejna |
| Service accounts | `panel` Linux user, pipeline jobs (Planned) | Sirf apna kaam |

---

## 4. Access Matrix

| Cheez | Reviewer | Lead reviewer | Client risk lead | MiraiGate admin | MiraiGate data team | Platform |
|---|---|---|---|---|---|---|
| Panel pages aur data | Dekh | Dekh | Dekh (account ho to) | Dekh | Dekh (account ho to) | – |
| Decisions submit / badalna | Haan | Haan | – | – | – | – |
| Pattern answers, notes | Haan (apna note hi hata sakte) | Haan | – | – | – | – |
| Decisions CSV export | Haan | Haan | – | Haan | – | – |
| Reviewer accounts banana/hatana | – | – | Approve | Karta hai (server CLI) | – | – |
| Panel server SSH | – | – | – | Haan (sirf apne IP se) | – | – |
| Ingest API (`POST /ingest`) | – | – | – | Test | – | Haan (API key) |
| MongoDB | – | – | – | Server ke andar se | Export ke liye | – |
| S3 backups | – | – | – | Haan | – | – |
| Workstation ka data | – | – | – | Haan | Haan | – |
| Admin view (Planned): runs, rollback, approvals | – | Approve (patterns) | Approve (limits) | Haan | Dekh | – |

Abhi panel me saare accounts ke same rights hain. Admin ka kaam server CLI se hota hai. Panel me admin role Phase 3 me aayega.

---

## 5. Panel: Sign-in aur Sessions (Bana hua)

| Control | Detail |
|---|---|
| Sign-in | Panel ka apna sign-in page; har page aur API ke liye sign-in zaroori (sirf sign-in page, sign-in/out API, aur do static files khule) |
| Password store | Salted PBKDF2-SHA256, 600,000 iterations, 16-byte random salt |
| Password ki shart | Kam se kam 8 characters, user name jaisa nahi |
| User name | Case ignore |
| Galat user name pe bhi same kaam | Dummy hash check, taaki time se pata na chale ki account hai ya nahi |
| Session token | 32-byte random; database me sirf SHA-256 hash |
| Cookie | `panel_session`; HttpOnly, SameSite=Lax; HTTPS pe Secure |
| Ek account, ek browser | Naye browser me sign in hote hi purana session `replaced`; purana browser 30 second me sign-in page pe, wajah ke saath |
| Session ki umar | 12 ghante bina activity; 7 din har haal me |
| Galat koshish ki limit | Ek user name pe 5, ya ek address se 20, 15 minute me; phir 15 minute ruko |
| nginx limit | `/api/login` pe 10 per minute, burst 5 |
| Doosri site se request | `Sec-Fetch-Site` header se data badalne wali cross-site requests reject |
| Cache | Client data wale responses `private, no-cache` |
| Headers | X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy no-referrer, X-Robots-Tag noindex, HSTS |
| Request size | Max 1 MB |
| Input limits | Reason 3–600 characters, note max 2,000, user name max 100 |

---

## 6. Account Lifecycle

| Step | Kaun | Kaise |
|---|---|---|
| 1. Request | Client risk lead | Naam aur role likh ke |
| 2. Approval | Client risk lead | Likhit (email ya ticket) |
| 3. Banana | MiraiGate admin | `sudo fraud-panel-users add <name>` |
| 4. Password dena | MiraiGate admin | Alag secure channel se (jaise password manager share). Chat ya plain email me nahi |
| 5. Password badalna | MiraiGate admin, user ke kehne pe | `fraud-panel-users passwd`; purana session khatam |
| 6. Hatana | MiraiGate admin, client ke kehne pe | Usi din `fraud-panel-users remove`; decisions history me naam rehta hai |
| 7. Access review | Client risk lead + MiraiGate admin | Har 3 mahine: `fraud-panel-users list` aur `last_login` dekh ke |

**Niyam:**
- Shared account nahi: har insaan ka apna account, kyunki decisions naam se jude hain.
- 90 din se use na hua account hataya jayega.
- Panel me khud password badalne ka option abhi nahi hai (Gap S-09).

---

## 7. Servers aur Network

| Control | Panel server | Ingest server |
|---|---|---|
| Bahar khule ports | 443, 80 (redirect) | API port, sirf client ke IP se (security group) |
| SSH | Sirf key, sirf admin ke IP se | Same |
| App kaise chalta hai | `panel` system user (no login shell), `127.0.0.1:8080` | Docker containers |
| Database | SQLite files, folder 750, files 640 | MongoDB auth ke saath, port publish nahi |
| systemd hardening | NoNewPrivileges, PrivateTmp, ProtectSystem=full, ProtectHome, sirf `data/` likh sakta | `restart: unless-stopped` |
| Security updates | unattended-upgrades (roz) | Same (deploy notes) |
| Logs | journald, nginx access log | Docker json logs, 50 MB × 3 |

---

## 8. Ingest API

| Control | Status |
|---|---|
| `X-API-Key` header har call pe (sirf `/health` khula) | Bana hua |
| Security group se sirf platform ke IP | Bana hua (setup pe confirm) |
| MongoDB internet pe nahi | Bana hua |
| HTTPS | **Gap S-01:** compose config me API port 80 (HTTP) pe hai |
| API key ka rotation | Har 90 din (proposal) |
| Pipeline ke liye alag read-only export token | Planned |

---

## 9. Secrets

| Secret | Kahan rehna chahiye | Kahan kabhi nahi |
|---|---|---|
| Panel passwords | Sirf users ke paas; database me hash | Chat, email, documents, code |
| SSH keys (`.pem`) | Admin ke machine pe, password manager / secure folder | Repository (`.gitignore` me `*.pem`, `*.key`) |
| Ingest API key, MongoDB password | Ingest server ki `.env` | Code, documents |
| S3 access | EC2 IAM role (keys nahi) | Files me access keys |
| Server addresses | Admin ke notes | Public documents |

**Gap S-04:** workstation pe ek notes file me server commands ke saath secrets bhi likhe hain. Inhe password manager me le jaana hai aur file se hatana hai.

---

## 10. Data Protection

| Control | Status |
|---|---|
| Panel traffic HTTPS (front proxy) | Bana hua |
| Client data repository me nahi (`data/`, `*.db` `.gitignore` me) | Bana hua |
| Panel me user ka naam (`name`) nahi dikhaya jaata; sirf user code | Bana hua |
| S3 backups: encryption at rest, public access band | Confirm karna hai (Gap S-05) |
| EC2 disks (EBS) encrypted | Confirm karna hai (Gap S-05) |
| Workstation pe exports: disk encryption (BitLocker) | Confirm karna hai (Gap S-06) |
| Exports aur CSV me masking | Data Privacy aur Retention Policy |

---

## 11. Gaps aur Actions

| ID | Gap | Risk | Action | Priority |
|---|---|---|---|---|
| S-01 | Ingest API HTTP pe | API key aur data raste me padhe ja sakte | Proxy / load balancer se HTTPS; HTTP band | P0 |
| S-02 | `users.db` ka backup nahi | Accounts aur sign-in history kho sakti | Backup script me jodna | P1 |
| S-03 | Panel dependencies ke version pinned nahi (`fastapi>=`, `uvicorn>=`) | Update me anjaana badlav | Versions pin karna; har 3 mahine review | P1 |
| S-04 | Secrets ek notes file me | Leak | Password manager | P0 |
| S-05 | S3 aur EBS encryption confirm nahi | Data at rest | Confirm aur chalu | P1 |
| S-06 | Workstation pe client data | Laptop/PC kho jaye to leak | Disk encryption; target me data S3 pe | P1 |
| S-07 | Panel me admin role nahi | Admin kaam sirf server pe | Phase 3 admin view | P2 |
| S-08 | Multi-factor sign-in nahi | Password leak pe access | Front proxy ya panel me MFA (proposal) | P2 |
| S-09 | Reviewer khud password nahi badal sakta | Admin pe nirbharta | Panel me "change password" | P2 |
| S-10 | Security alerts (bahut galat sign-ins) nahi jaate | Attack der se pata | Monitoring me alert | P2 |

---

## 12. Review

- **Har 3 mahine:** access review (Section 6), gaps ki status, dependencies.
- **Har bade badlav pe:** is document ka update.
- **Security incident:** Incident Response Playbook.

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
