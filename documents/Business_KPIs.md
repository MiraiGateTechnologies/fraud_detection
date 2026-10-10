# Business KPIs
# Fraud Detection Platform

| Item | Detail |
|---|---|
| Document | Business KPIs |
| Version | 1.0 (review ke liye draft) |
| Date | 10 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Baseline data | 15 Sep se 8 Oct 2026 (24 din, betting data wale 55,414 requests) |
| Related documents | Monitoring aur Drift Plan; Score aur Threshold Policy; Service Levels aur Timing; Fraud Risk Assessment aur Taxonomy |

**Targets proposal hain.** Client risk lead ke sign-off ke baad lagu honge.

---

## 1. Purpose

System ki value business ke numbers me naapni hai, sirf model metrics (AUC waghera) me nahi. Ye document tay karta hai:
- kaunse KPIs naape jayenge aur unka formula
- data kahan se aayega
- abhi ka baseline kya hai
- target kya hai aur owner kaun

---

## 2. Paise ka Hisaab Kaise

- **Withdrawal amount data me nahi aata** (`extra.amount` hamesha khaali; Data Contract G-06).
- Isliye abhi "paisa" ka matlab: request ke time tak ke 20 din me user ka casino + sports **profit** (`total_game_pl`). Ye wahi rakam hai jo user house se jeet ke nikaalna chahta hai.
- Platform `amount` bhejne lage to KPI-01 aur KPI-02 asli withdrawal amount pe naapenge, aur baseline dobara banega.

---

## 3. KPIs ka Overview

| Group | KPIs | Sawaal |
|---|---|---|
| A. Fraud ka asar | KPI-01 se KPI-04 | Kitna fraud pakda aur roka; model ne kya joda |
| B. Galat alarm | KPI-05 se KPI-08 | Genuine users pe kitna bojh |
| C. Review operations | KPI-09 se KPI-13 | Reviewers ka kaam aur speed |
| D. System aur seekhna | KPI-14 se KPI-18 | Data, coverage aur feedback |

---

## 4. A. Fraud ka Asar

### KPI-01: Fraud Pakda Gaya (₹ aur cases)
| Item | Detail |
|---|---|
| Formula | Requests jinhe reviewer ne **Fraud** mark kiya, ya agent ne fraud wajah se reject kiya: ginti aur paisa |
| Source | Panel decisions; agent status aur remarks; Labeling Policy |
| Baseline | Training ke fraud examples: **62 requests, ₹1.29 crore**. Panel decisions abhi training/report me nahi jude (n/a) |
| Target | Har mahine report; trend upar (zyada pakda), jab tak fraud ka level na gire |
| Kitni baar | Weekly, monthly |
| Owner | Client risk lead |

### KPI-02: Model ne Kitna Pakda
| Item | Detail |
|---|---|
| Formula | KPI-01 ke cases me se kitne model ke **60%+** pe the: (a) ginti ka %, (b) paise ka % |
| Source | Scores (model akele, out-of-fold) + KPI-01 |
| Baseline | (a) **42 / 62 = 68%** cases; (b) **₹31.9 lakh / ₹1.29 crore = 25%** paisa |
| Target | 3 mahine me (a) 75%, (b) 50% |
| Kitni baar | Monthly |
| Owner | MiraiGate data lead |

**Ginti aur paise me itna farak kyun:** sabse bade fraud cases purane accounts ke P1 (casino) hain, aur unka score Score Policy ke purane-account niyam ki wajah se 60 se neeche hai. Ye Fraud Risk Assessment me R-14 hai.

### KPI-03: Model aur Agents ka Milan
Agent rejects (betting data wale) aur model ke 60%+ score ko milaake:

| Bucket | Matlab | Requests | Users | Paisa (profit) |
|---|---|---|---|---|
| Dono ne pakda | Agent reject + model 60%+ | 85 | 77 | ₹52.7 lakh |
| Sirf agents ne | Agent reject, model 60 se neeche | 187 | 164 | ₹2.47 crore |
| Sirf model ne | Agent approve, model 60%+ | 565 | 370 | ₹4.39 crore |

- "Sirf agents ne" me zyadatar rejects ki wajah saaf nahi ("hold" waghera), ya wo back-lay wale purane accounts hain.
- **"Sirf model ne" sabse ahem bucket hai.** Ye wo cases hain jo agents ne approve kiye par model ne uthaye.
  - Inme kitne asli fraud hain, ye reviewers ke decisions batayenge (KPI-04).
  - Jab tak decisions nahi aate, inhe fraud ya galat alarm nahi maana jaata.
- Floor wali 23 baad ki requests is table se bahar hain.

| Item | Detail |
|---|---|
| Kitni baar | Monthly |
| Owner | MiraiGate data lead |

### KPI-04: Model se Naya Pakda Gaya Fraud (incremental)
| Item | Detail |
|---|---|
| Formula | "Sirf model ne" wale players me se jinhe reviewer ne Fraud mark kiya: ginti aur paisa |
| Source | Panel decisions + scores |
| Baseline | n/a (panel decisions abhi report me nahi) |
| Target | Pehle 3 mahine baseline banana; phir target |
| Kitni baar | Monthly |
| Owner | Client risk lead |

**Yahi system ki asli value hai:** wo fraud jo model ke bina approve ho jaata.

---

## 5. B. Galat Alarm

### KPI-05: Genuine Requests 60%+ pe
| Item | Detail |
|---|---|
| Formula | Genuine label wale requests jinka model score 60%+ / saare genuine |
| Baseline | **0.89%** (486 requests) |
| Target | 1% ya kam |
| Kitni baar | Weekly |
| Owner | MiraiGate data lead |

### KPI-06: Genuine Requests 90%+ pe
| Item | Detail |
|---|---|
| Formula | Upar jaisa, 90%+ |
| Baseline | **0.033%** (18 requests) |
| Target | 0.1% ya kam (release gate bhi yahi) |
| Kitni baar | Har release, weekly |
| Owner | MiraiGate data lead |

### KPI-07: Queue Precision
| Item | Detail |
|---|---|
| Formula | Review hue 60%+ players me se jinhe reviewer ne Fraud mark kiya |
| Source | Panel decisions |
| Baseline (proxy) | Model 60%+ requests me agent reject rate **13.1%**; 90%+ me **41.6%** |
| Target | 3 mahine me: 60%+ pe 20%, 90%+ pe 50% (reviewer decisions pe) |
| Kitni baar | Weekly |
| Owner | Client lead reviewer |

### KPI-08: Genuine Users pe Asar
| Item | Detail |
|---|---|
| Formula | Genuine players jinka withdrawal score ki wajah se ruka ya der hui |
| Baseline | **0**. Score abhi withdrawal nahi rokta; data agent ke faisle ke baad aata hai |
| Target | Real-time path aane ke baad: genuine me 0.1% se kam withdrawals par 5 minute se zyada der |
| Kitni baar | Monthly (real-time path ke baad) |
| Owner | Client risk lead |

---

## 6. C. Review Operations

### KPI-09: Reviewer ka Roz ka Kaam
| Item | Detail |
|---|---|
| Formula | Queue me roz aane wale naye players (60%+) |
| Baseline | **18.4 players/din** (24 din me 441 players, 693 requests) |
| Target | 40 se kam |
| Kitni baar | Weekly |
| Owner | Client lead reviewer |

### KPI-10: Faisle me Lagne wala Time (reviewer)
| Item | Detail |
|---|---|
| Formula | Player queue me aane se reviewer decision tak |
| Source | Panel (queue me aane ka time record karna hoga) |
| Baseline | n/a |
| Target | 90% players: Very high 4 ghante me, High 24 ghante me |
| Kitni baar | Weekly |
| Owner | Client lead reviewer |

### KPI-11: Backlog
| Item | Detail |
|---|---|
| Formula | Waiting players; sabse purana waiting player kitne ghante se |
| Baseline | n/a (panel se aayega) |
| Target | Sabse purana 24 ghante se kam |
| Kitni baar | Roz |
| Owner | Client lead reviewer |

### KPI-12: Agent ke Faisle ka Time (platform, context ke liye)
| Item | Detail |
|---|---|
| Formula | `createdAt` se `action_time` |
| Baseline | Median **2.7 minute**; rejects ka median 6.2 minute |
| Target | System ka target nahi; real-time score ki zarurat dikhata hai (score 42 second me chahiye) |
| Kitni baar | Monthly |
| Owner | Client operations |

### KPI-13: Saaf Wajah wale Faisle
| Item | Detail |
|---|---|
| Formula | (a) Agent rejects jinki wajah saaf hai; (b) reviewer decisions jinka reason data se juda hai |
| Baseline | (a) **67%** (307 me se 100 rejects bina saaf wajah: "hold", ".", naam); (b) n/a |
| Target | (a) 90% (remark codes ke baad); (b) 100% |
| Kitni baar | Weekly |
| Owner | (a) Client operations; (b) Client lead reviewer |

---

## 7. D. System aur Seekhna

| ID | KPI | Baseline | Target | Owner |
|---|---|---|---|---|
| KPI-14 | Scored coverage: requests jinka score bana | 98.2% | 98% ya zyada | MiraiGate data team |
| KPI-15 | Data freshness: request se panel tak | 1 se 4 din (manual) | 26 ghante (batch), 1 minute (real-time) | MiraiGate admin |
| KPI-16 | Panel availability | Naapa nahi gaya | 99% | MiraiGate admin |
| KPI-17 | Reviewer decisions jo training me gaye | 0% (abhi jude nahi) | Cut-off se pehle ke 100% | MiraiGate data lead |
| KPI-18 | Model quality: AUC; 1% galat alarm pe fraud catch | 0.984; 66% | Production se kam nahi (gates) | MiraiGate data lead |

---

## 8. Hisaab ke Niyam

1. **Ek request, ek baar:** koi request do buckets me nahi gini jaati.
2. **Attribution:**

| Bucket | Shart |
|---|---|
| Model-led | Model 60%+ AUR agent ne approve kiya AUR reviewer ne Fraud mark kiya |
| Agent-led | Agent ne fraud wajah se reject kiya AUR model 60 se neeche |
| Joint | Agent reject AUR model 60%+ |

3. **Platform ki galti** wale rejects (wrong odds, technical issue) fraud me nahi gine jaate.
4. **Badla hua decision:** sirf player ka aakhri decision gina jaata hai.
5. **Model score:** training records ka out-of-fold score; training fraud examples ka 95% minimum KPI me nahi lagta.
6. **"Roka gaya" ka saboot:** jab platform `amount` aur final action (block / void) bheje, tabhi "roka gaya paisa" report hoga. Tab tak naam "pakda gaya" (profit proxy) rahega.

---

## 9. Reporting

| Report | Kab | Kisko | KPIs |
|---|---|---|---|
| Weekly summary | Monday | MiraiGate + client risk lead + lead reviewer | KPI-05, 06, 07, 09, 10, 11, 13 |
| Monthly business review | Mahine ka pehla hafta | Client management + MiraiGate | Saare KPIs, trend aur targets ke saamne |
| Quarterly target review | Har 3 mahine | Client risk lead + MiraiGate data lead | Targets badalne ka faisla |

Abhi ye numbers manual nikaale jaate hain. Panel ke admin view (Phase 3) me dashboard banega.

---

## 10. Data Gaps jo KPIs Rokte Hain

| Gap | Kaunse KPI | Kya chahiye |
|---|---|---|
| Withdrawal amount nahi aata | KPI-01, 02, 04 | Platform se `amount` (Data Contract G-06) |
| Platform ka final action (block / void / pay) nahi aata | KPI-01, 04 | Platform se final action |
| Queue me aane ka time record nahi hota | KPI-10, 11 | Panel me record karna |
| Panel decisions report me nahi jude | KPI-04, 07, 17 | Feedback export (automation Phase 1) |

---

## 11. Open Decisions

| # | Sawaal | Proposal |
|---|---|---|
| 1 | Targets (Section 4–7) | Upar wale proposal |
| 2 | Monthly business review me kaun | Client risk lead, client management, MiraiGate data lead |
| 3 | Paisa withdrawal amount pe ya profit pe | Amount aane tak profit |

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
