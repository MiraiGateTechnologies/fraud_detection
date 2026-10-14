# Roles aur Responsibilities (RACI)
# Fraud Detection Platform

| Item | Detail |
|---|---|
| Document | Roles aur Responsibilities (RACI) |
| Version | 1.1 (review ke liye draft) |
| Date | 14 Oct 2026 |
| Organisation | MiraiGate Technologies |
| Related documents | Saare documents is RACI ke hisaab se owners lete hain |

---

## 1. Purpose

MiraiGate, client ke reviewers, client ki risk/compliance team aur platform IT ke beech saaf hona chahiye ki kaun kya sambhalta hai.

**RACI ka matlab:**

| Letter | Matlab |
|---|---|
| **R** (Responsible) | Kaam karta hai |
| **A** (Accountable) | Aakhri zimmedar; approve karta hai. Har kaam ka sirf ek A |
| **C** (Consulted) | Kaam se pehle ya beech me raay di jaati hai |
| **I** (Informed) | Kaam ke baad bataya jaata hai |

---

## 2. Roles

| Code | Role | Organisation |
|---|---|---|
| PLT | Platform IT / product owner | Client platform |
| CRL | Client risk lead | Client |
| LRV | Lead reviewer | Client |
| RV | Reviewers (User1–User6) | Client |
| CMP | Compliance / legal | Client |
| MDL | MiraiGate data lead | MiraiGate |
| MDT | MiraiGate data team | MiraiGate |
| MAD | MiraiGate admin / on-call | MiraiGate |

Har role ke naam sign-off pe Section 4 me bhare jayenge.

---

## 3. RACI Matrix

### 3.1 Data
| Kaam | PLT | CRL | LRV | RV | CMP | MDL | MDT | MAD |
|---|---|---|---|---|---|---|---|---|
| Risk events ka feed bhejna | **A/R** | I | | | | I | I | C |
| Data Contract aur schema badlav | **A/R** | C | | | | C | C | I |
| Data quality checks aur quarantine | I | | | | | **A** | R | C |
| Data gaps band karna (bet time, IP, status codes) | **A/R** | C | | | | C | I | |
| Agent remarks ki quality (tay list) | C | **A** | R | | | C | | |
| Live data replica set me likhna (driver, retry, fixed `_id`) | **A/R** | I | | | | I | I | C |
| Egress IP, teen collections ka schema aur volume dena | **A/R** | C | | | | C | C | I |

### 3.2 Labels aur Review
| Kaam | PLT | CRL | LRV | RV | CMP | MDL | MDT | MAD |
|---|---|---|---|---|---|---|---|---|
| Roz ke cases review karna | | I | C | **R** | | | | |
| Review ki quality aur backlog | | I | **A/R** | R | | I | | |
| Reviewers ke takraav suljhana | | I | **A/R** | C | | I | | |
| Labeling policy aur badlav | | **A** | C | | | R | R | |
| Unclear cases ka faisla (review list) | | **A** | C | | | R | R | |
| Naya pattern approve karna | | **A** | R | C | | C | R | |
| Reviewer SOP ka rakh-rakhaav | | **A** | R | C | | C | | |

### 3.3 Models aur Scores
| Kaam | PLT | CRL | LRV | RV | CMP | MDL | MDT | MAD |
|---|---|---|---|---|---|---|---|---|
| Retrain chalana | | I | | | | **A** | R | C |
| Quality gates aur model release | | I | I | | | **A** | R | C |
| Model rollback | | I | I | | | **A** | R | R |
| Model cards aur validation | | I | | | | **A** | R | |
| Score limits (queue 60%, purana account, bonus limit) | | **A** | C | | | R | C | |
| Training fraud example ka minimum (95%) | | **A** | C | | | R | | |
| Taxonomy aur risk assessment ka update | | **A** | C | | C | R | R | |
| Monitoring aur drift ka jawab | | I | | | | **A** | R | R |

### 3.4 Panel aur Infrastructure
| Kaam | PLT | CRL | LRV | RV | CMP | MDL | MDT | MAD |
|---|---|---|---|---|---|---|---|---|
| Panel server chalana aur updates | | I | I | | | C | | **A/R** |
| Ingest server chalana | C | | | | | C | | **A/R** |
| MongoDB replica set chalana (failover, patching, snapshots, monitoring) | I | I | | | | C | | **A/R** |
| Backups aur restore test | | I | | | | I | | **A/R** |
| AWS account, kharcha | | **A** | | | | C | | R |
| Domain, DNS, HTTPS proxy | C | **A** | | | | | | R |
| Panel me naye features | | **A** | C | C | | R | R | C |

### 3.5 Access aur Security
| Kaam | PLT | CRL | LRV | RV | CMP | MDL | MDT | MAD |
|---|---|---|---|---|---|---|---|---|
| Reviewer account ki request aur approval | | **A** | R | | | | | I |
| Account banana, password, hatana | | C | I | I | | | | **A/R** |
| Har 3 mahine access review | | **A** | C | | | I | | R |
| Secrets aur keys ka rotation | C | | | | | I | | **A/R** |
| Security incident | I | C | I | | C | C | | **A/R** |

### 3.6 Privacy aur Compliance
| Kaam | PLT | CRL | LRV | RV | CMP | MDL | MDT | MAD |
|---|---|---|---|---|---|---|---|---|
| Compliance matrix ka legal review | | C | | | **A/R** | C | | |
| Client–MiraiGate data processing terms | | C | | | **A** | R | | |
| User ki erasure request | | I | | | **A** | C | R | R |
| Retention aur deletion | | I | | | **A** | R | R | R |
| Breach ki khabar authorities aur users ko | | C | | | **A/R** | C | | C |
| AML reporting (agar lagu) | | C | | | **A/R** | C | | |
| Live data Singapore me rakhne ki approval (cross-border) | | C | | | **A/R** | C | | I |

### 3.7 Incidents aur Communication
| Kaam | PLT | CRL | LRV | RV | CMP | MDL | MDT | MAD |
|---|---|---|---|---|---|---|---|---|
| Sev 1 / Sev 2 incident handle karna | C | I | I | | I | C | R | **A/R** |
| Client ko incident updates | | I | I | | | **A/R** | | C |
| Reviewers ko batana (outage, dobara review) | | I | **A/R** | I | | C | | |
| Incident review | C | C | C | | | **A** | R | R |
| Weekly summary aur monthly model review | | I | I | | | **A** | R | |

---

## 4. Naam (sign-off pe)

| Code | Naam | Backup |
|---|---|---|
| PLT | | |
| CRL | | |
| LRV | | |
| CMP | | |
| MDL | | |
| MAD | | |

---

## 5. Review

Har 6 mahine, ya jab koi role badle.

## Change Log
| Version | Date | Badlav |
|---|---|---|
| 1.0 | 10 Oct 2026 | Pehla draft |
| 1.1 | 14 Oct 2026 | MongoDB replica set ke kaam: platform ka likhna aur IP/schema dena, MiraiGate ka replica set chalana, cross-border approval |
