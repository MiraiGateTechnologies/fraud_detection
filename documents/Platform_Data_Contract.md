# Platform ke saath Data Contract
# Fraud Detection Platform: Risk Event Feed

| Item | Detail |
|---|---|
| Document | Data Contract (platform → fraud detection) |
| Version | 1.1 (review ke liye draft) |
| Date | 14 Oct 2026 |
| Data dene wala | Client platform (betting aur casino) |
| Data lene wala | MiraiGate Technologies, Fraud Detection Platform |
| Related documents | Data Dictionary; Data Quality aur Lineage; Service Levels aur Timing; MongoDB Replica Set SRS |

---

## 1. Purpose

Fraud detection ka saara source data platform se aata hai. Jo fields gayab ya bina matlab ke hain, unki wajah se model kam seekh pata hai, aur unhe sirf platform hi theek kar sakta hai.

Ye contract teen cheezein tay karta hai:
1. platform kya data, kis shakl me aur kab bhejega
2. data ki quality ke kaunse vaade hain
3. badlav kaise honge

---

## 2. Scope

- **Shamil hai (abhi, temporary):** platform pe flag hui har withdrawal request (risk event), uske saath user, bets aur statements ka snapshot.
- **Shamil hai (live data, contract ke baad):** har withdrawal request, user, bets aur statements, jo platform seedha hamare MongoDB replica set me likhega. Agent ke faisle (approve/reject, remarks, locks) isme nahi aayenge.
- **Shamil nahi hai:** card ya bank details, KYC documents, passwords. Inki zarurat nahi hai aur inhe nahi bhejna hai.

---

## 3. Delivery

### 3.1 Abhi Kaise Aata Hai
- Platform `POST /ingest` pe ek lambi HTTPS connection kholta hai aur NDJSON me records bhejta rehta hai.
- Har request pe header `X-API-Key` hota hai.
- Ingest service 500 records ya 2 second (jo pehle ho) ke batch me MongoDB me upsert karti hai. Key `_id` hai.
- **Record agent ke faisle ke baad aata hai** (median 1.8 second baad). Request bante waqt kuch nahi aata.

### 3.2 Contract ke Baad Kaise Aayega

**Raasta:** platform data seedha hamare **MongoDB replica set** me likhega (MongoDB driver se), `POST /ingest` nahi.

| Item | Value |
|---|---|
| Connection string | `mongodb+srv://client_writer@betting-data-ingest.prime1.one/fraud?tlsCAFile=ca.pem&retryWrites=true` (password alag, secure tareeke se) |
| Database | `fraud` |
| Collections | `surveillance`, `bets`, `statements` (fields Section 4 ke hisaab se; aakhri schema platform confirm karega) |
| Kitni baar | Har ~10 second, naye ya badle records |
| User | `client_writer`: sirf insert, update aur find; delete nahi |
| Failover | Primary server gire to 10–15 second me doosra primary ban jaata hai; driver khud naye primary pe likhta hai, connection string nahi badalti |

Servers, security aur DNS ki detail MongoDB Replica Set SRS me hai.

| Event | Kab bhejna hai | Kya bhejna hai |
|---|---|---|
| **Created** | Request bante hi, 10 second ke andar | Poora record, `status = "pending"`, user + bets + statements ke saath |
| **Decided** | Agent ke faisle ke 60 second ke andar | Same `_id`; `status`, `remarks`, `reason`, locks, `action_time` |
| **Corrected** | Kabhi bhi record badle (jaise status badla) | Same `_id`, poora naya version, naya `updatedAt` |

**Niyam:**
- Same `_id` dobara aaye to naya version purane ki jagah lega (idempotent). Order ki guarantee zaroori nahi; `updatedAt` se naya version tay hoga.
- "Created" event ke bets aur statements request ke time tak ke hi hon.
- Driver me `retryWrites=true` rahe. Write fail ho (network, ya failover ke 10–15 second) to platform record apne paas rakh ke dobara likhega, 24 ghante tak. MongoDB ka write acknowledgement milne tak record likha hua nahi maana jayega.
- Live data me agent ke faisle (`status`, `remarks`, `reason`, locks, `action_time`) nahi aayenge (System SRS, Section 2.5). "Decided" aur "Corrected" events tabhi lagu honge jab platform ye bhejne ko tayyar ho; warna sirf "Created" aayega.

### 3.3 Fallback
Feed band ho to platform JSON export (same schema) de sakta hai. Next run use utha lega.

---

## 4. Schema

Har field ka poora matlab Data Dictionary me hai. Yahan sirf zaroori shartein hain.

### 4.1 Risk Event
| Field | Type | Zaroori | Shart |
|---|---|---|---|
| `_id` | string | Haan | Unique, kabhi nahi badlega |
| `schema_version` | string | Haan (naya) | Jaise `"1.0"` |
| `user_id` | integer | Haan | User ki pakki pehchaan |
| `user_id_str` | string | Haan | Trim kiya hua, ek hi case me |
| `master_id`, `master_id_str` | integer, string | Haan | Request ke time ka master |
| `white_label_id`, `white_label_id_str` | integer, string | Haan | |
| `provider_id`, `source` | string | Haan | Values ki list platform dega |
| `transaction_id` | string | Haan | |
| `amount` | number, ₹ | Haan (naya; `extra.amount` ki jagah) | Withdrawal ki rakam, kabhi null nahi |
| `status` | string | Haan | `pending`, `approved`, `reject` |
| `remarks` | string | Faisle pe haan | Section 4.5 |
| `remark_code` | string | Faisle pe haan (naya) | Tay list me se (Section 4.5) |
| `reason` | array | Reject pe haan | `cat`, `reason`, `description` |
| `user_lock`, `withdrawal_lock`, `bet_void` | boolean | Haan | |
| `createdAt`, `updatedAt`, `action_time` | ISO datetime UTC, `Z` ke saath | Haan (`action_time` faisle pe) | |
| `request_ip`, `request_device_id` | string (hash) | Haan (naya) | Withdrawal request ka IP aur device, hash karke |
| `surveillance` | array, 1 item | Haan | Section 4.2 |

### 4.2 Surveillance Bundle
| Field | Zaroori | Shart |
|---|---|---|
| `user` | Haan | Kabhi khaali nahi |
| `bets` | Haan (khaali list chalegi agar bets nahi) | Request se pehle ke 20 din |
| `statements` | Haan | Request se pehle ke 20 din, poore |
| andar wali `surveillance` | – | Matlab batayein, ya hata dein |

### 4.3 Bet
| Field | Type | Zaroori | Note |
|---|---|---|---|
| `bet_id`, `event_id`, `market_id`, `selection_id`, `sport_id` | id | Haan | |
| `bet_market_type` | integer | Haan | 1 / 2 / 3 ki list likhi jaye |
| `selection`, `selection_type` | string | Haan | `back` / `lay` |
| `odds`, `requested_odds`, `stake`, `p_l`, `liability` | number (string nahi) | Haan | Fancy market me `odds` ka matlab likha jaye |
| `bet_status` | integer | Haan | Har code ka matlab likha jaye |
| `reason` | string ya null | – | Void/cancel ki wajah |
| `placed_at` | ISO datetime UTC | **Haan (naya)** | Bet kab lagi |
| `settled_at` | ISO datetime UTC | Haan (naya) | Bet kab settle/void hui |
| `bet_ip`, `bet_device_id` | string (hash) | Haan (naya) | |

### 4.4 Statement
| Field | Type | Zaroori | Note |
|---|---|---|---|
| `id`, `user_id` | integer | Haan | |
| `txn_id` | string | Haan jahan transaction ho | Abhi 10.9% me null |
| `description` | string | Haan | |
| `entry_type` | string | Haan (naya) | deposit / withdrawal / bonus / casino / sports / other |
| `pl`, `balance` | number (string nahi), ₹ | Haan | |
| `created_at` | ISO datetime UTC, `Z` ke saath | Haan | Abhi zone ka mark nahi aata |

### 4.5 Remarks ki Tay List (naya)
Agent ek code chunega aur chahe to text bhi likhega.

| `remark_code` | Matlab |
|---|---|
| `CASINO_CHECK` | Casino provider ke saath check |
| `CHEAT_BETS` | Cheat ya suspicious bets |
| `BACK_LAY` | Back-lay / kai runners pe back |
| `GROUND_LINE` | Ground line betting |
| `MULTI_ACCOUNT` | Same IP / multiple users |
| `BONUS_ABUSE` | Bonus abuse |
| `GROUP_BETTING` | Group betting |
| `NO_ACTIVITY` | Bina khel ke withdrawal |
| `PLATFORM_ERROR` | Wrong odds, technical issue, market galti se khula |
| `SMALL_AMOUNT` | Chhoti rakam |
| `HOLD_PENDING` | Abhi check chal raha hai (final faisla baad me update hoga) |
| `OTHER` | Doosri wajah (text zaroori) |

Abhi 100 rejects (33%) ka remark sirf "hold", ".", ya agent ka naam hai. Inse koi label nahi banta.

---

## 5. Band Karne Wale Gaps

| ID | Gap | Abhi | Chahiye | Kyun zaroori | Priority |
|---|---|---|---|---|---|
| G-01 | Record faisle ke baad aata hai | Faisle ke median 1.8 sec baad | Request bante hi "created" event | Score agent ki madad kar sake | P0 |
| G-02 | Bets me time nahi | Sirf `bet_id` ka order | `placed_at`, `settled_at` | Ground line, late bets, bet sequence | P0 |
| G-03 | IP aur device nahi | Kuch nahi | Request aur bet ka IP/device (hash) | Multi-accounting, same IP groups | P0 |
| G-04 | `bet_status` ka matlab nahi | Codes 1, 2, 3, 4, 5, 8, 9 | Har code ka matlab | Void/settled/cancelled alag karna | P0 |
| G-05 | Remark free text | 33% rejects bina saaf wajah | `remark_code` list | Saaf labels | P1 |
| G-06 | `extra.amount` khaali | Hamesha null | `amount` | Withdrawal ki rakam, impact | P1 |
| G-07 | Status baad me badle to update | Pata nahi | "Corrected" event | Final label sahi | P1 |
| G-08 | Kuch records bina data | 1.8% bina statements, 1.3% bina user, 59 bina bundle | 99% records poore | Score ban sake | P1 |
| G-09 | Andar wali `surveillance` list | Hamesha khaali | Matlab ya hatana | Schema saaf | P2 |
| G-10 | `source`, `actw`, `action`, `risk_status` | Matlab nahi / hamesha khaali | Matlab ya hatana | Schema saaf | P2 |
| G-11 | Time zone ka mark | Statement/user time bina zone | UTC `Z` ke saath | Time ki galti na ho | P2 |
| G-12 | Number string me | `stake`, `pl`, `odds` string | Number | Parsing ki galti na ho | P2 |
| G-13 | Reason ke naam ek jaise nahi | "Same IP Multiple User/user" | Tay list | Ginti sahi | P2 |
| G-14 | Sport aur market ki list | `sport_id` 4344 ka matlab nahi | Poori list | Reports sahi | P2 |
| G-15 | Platform ke servers ka IP nahi mila | – | Egress IP ya IP range (jis IP se platform ke servers internet pe jaate hain) | Replica set ka port sirf platform ke liye kholna; na mile to client certificate (mutual TLS) | P0 |
| G-16 | Teen collections ka schema aur volume | – | `surveillance`, `bets`, `statements` ke fields, time field, roz kitni bets | Indexes, 60 din ka TTL aur disk size tay karna | P0 |

---

## 6. Quality ke Vaade (Platform)

| Measure | Target |
|---|---|
| "Created" event ka time | Request bante hi 10 second ke andar (95%) |
| "Decided" event ka time | Faisle ke 60 second ke andar (99%) |
| Poore records (user + statements) | 99% |
| Schema ke hisaab se valid | 99.9% |
| Duplicate `_id` me galat data | 0 |
| Feed ki availability | 99.5% har mahine |
| Feed band hone ki khabar | 1 ghante ke andar MiraiGate ko |

---

## 7. Hamare Checks (har batch)

| Check | Limit | Fail hua to |
|---|---|---|
| Schema | Zaroori fields aur types | Record quarantine |
| Count | 7 din ke average ke 30% ke andar | Batch quarantine + alert |
| Bina bets aur statements | 5% se kam | Batch quarantine + alert |
| Duplicate `_id` | Report | Naya version lagta hai |
| Time ka order | `createdAt` ≤ `action_time` ≤ `ingested_at` | Record flag |
| Request ke baad ke statements | Report | Features me nahi liye jaate |
| Naye ya anjaane enum values | Report | Platform se poochha jayega |

**Quarantine ka matlab:** batch scoring me nahi jaata; panel pichhla data dikhata hai. MiraiGate 1 business day me platform ko batayega, aur theek batch aane pe wo process hoga.

---

## 8. Badlav ka Process

| Badlav | Notice | Shart |
|---|---|---|
| Naya optional field (additive) | 7 din | `schema_version` ka minor number badhe |
| Field ka type ya matlab badalna, field hatana, enum badalna (breaking) | 30 din | Major version badhe; sample data pehle mile; 7 din dono version saath chalein |
| Emergency (security ya legal) | Jitna jaldi ho sake | Turant khabar, baad me likhit note |

- Har badlav ki ek line ki entry is document ke change log me hogi.
- Bina notice ke breaking badlav aaye to batch quarantine hoga aur Sev 2 incident maana jayega.

---

## 9. Security aur Privacy

- Saara data TLS pe aayega (MongoDB connection me `tls=true`; hamara CA certificate `ca.pem` platform ko diya jayega).
- Platform `client_writer` user se likhega, jo sirf `fraud` database me insert, update aur find kar sakta hai; delete nahi. Password Secrets Manager me rahega aur har 90 din badlega.
- Replica set ka port 27017 sirf platform ke tay IP addresses (egress IP) ke liye khula hoga. IP na mile to client certificate (mutual TLS) zaroori hoga (G-15).
- Temporary ingest service ke liye pehle jaisa: HTTPS, API key har 90 din, sirf platform ke IP.
- IP aur device id **hash** karke bheje jayenge (salt platform ke paas). Hamein sirf ye chahiye ki do users ka hash same hai ya nahi.
- User ka `name` scoring me use nahi hota. Platform chahe to ise bhejna band kar sakta hai.
- Data AWS (Singapore region) me encrypted rehta hai: disk encryption aur TLS. Live data 60 din baad apne aap hat jaata hai. Retention ke niyam Data Privacy aur Retention Policy me hain.

---

## 10. Support aur Escalation

| Kya hua | Pehle kise batana hai | Response |
|---|---|---|
| Feed band ya bahut kam data | Platform IT on-call | 2 ghante |
| Schema galat | Platform IT | 1 business day |
| Matlab ya documentation ka sawaal | Platform product owner | 3 business days |

Naam aur contact sign-off ke time bhare jayenge.

---

## 11. Sign-off

| Role | Naam | Date |
|---|---|---|
| Platform product owner | | |
| Platform IT lead | | |
| MiraiGate data lead | | |

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
| 1.1 | 14 Oct 2026 | Live data ka raasta: platform seedha MongoDB replica set me likhega (`betting-data-ingest.prime1.one`, `fraud` DB, teen collections), `POST /ingest` sirf temporary. Retry ke niyam, agent ke faisle live data me nahi. Security: TLS, `client_writer`, IP allowlist ya mutual TLS. Naye gaps G-15 (egress IP) aur G-16 (schema aur volume) |
